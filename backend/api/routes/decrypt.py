"""Decrypt endpoints."""
import os
import hashlib
import asyncio
import logging
import tempfile
from fastapi import APIRouter, Request, File, UploadFile, Form, Depends, HTTPException
from fastapi.responses import StreamingResponse

from models.schemas import DecryptRequest
from core import security
from core.config import settings
from services.file_service import FileService
from services.encryption_service import EncryptionService
from api.dependencies import get_file_service_dep, get_encryption_service_dep
from utils import crypto_utils
from storage import client_storage
from services import analytics
from services import webhook_service
from core.concurrency import decrypt_semaphore, iter_bytes

logger = logging.getLogger(__name__)

router = APIRouter()

# Rate-limit budget for the client-side decrypt endpoint.
# Kept intentionally low: each hit triggers PBKDF2 KDF work which is
# CPU-intensive, so an attacker who can flood us here gets a double win
# (guessing + DoS).  10 req/min per IP is more than enough for a legitimate
# human use-case while making automated dictionary attacks impractical even
# before the PBKDF2 cost is factored in.

_DECRYPT_RATE_LIMIT = 10  # requests per 60-second window per IP

# ── Per-file lock registry (CWE-362 fix) ─────────────────────────────────────
# Serialises the read → decrypt → increment → write/destroy cycle for each
# bar_id so concurrent requests cannot both read the same current_views value
# and silently lose an increment (or bypass burn-after-read).
#
# The registry uses reference counting to safely evict idle locks:
#   _acquire_file_lock  → increments refcount (or creates lock + sets count=1)
#   _release_file_lock  → decrements refcount; evicts when count reaches 0
# Both operations hold _file_locks_guard, so no interleaving can cause a
# coroutine to acquire a lock that another coroutine is about to evict.
_file_locks: dict[str, asyncio.Lock] = {}
_file_lock_refcounts: dict[str, int] = {}
_file_locks_guard = asyncio.Lock()  # protects both dicts above


async def _acquire_file_lock(bar_id: str) -> asyncio.Lock:
    """Return (and lazily create) the per-file lock, incrementing its refcount."""
    async with _file_locks_guard:
        if bar_id not in _file_locks:
            _file_locks[bar_id] = asyncio.Lock()
            _file_lock_refcounts[bar_id] = 0
        _file_lock_refcounts[bar_id] += 1
        return _file_locks[bar_id]


async def _release_file_lock(bar_id: str) -> None:
    """Decrement the refcount and evict the lock when no waiters remain."""
    async with _file_locks_guard:
        count = _file_lock_refcounts.get(bar_id, 0) - 1
        if count <= 0:
            _file_locks.pop(bar_id, None)
            _file_lock_refcounts.pop(bar_id, None)
        else:
            _file_lock_refcounts[bar_id] = count


def _atomic_write(file_path: str, data: bytes) -> None:
    """Write *data* to *file_path* atomically via temp-file + os.replace.

    If the process crashes mid-write, *file_path* retains its previous
    contents (or is absent) — it is never left in a half-written state.
    """
    dir_name = os.path.dirname(file_path)
    fd, tmp_path = tempfile.mkstemp(dir=dir_name, suffix=".tmp")
    try:
        os.write(fd, data)
        os.close(fd)
        fd = -1  # mark as closed so the except branch doesn't double-close
        os.replace(tmp_path, file_path)
    except BaseException:
        if fd >= 0:
            os.close(fd)
        # Clean up the temp file on failure; ignore errors (it may not exist).
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


@router.post("/decrypt/{bar_id}")
async def decrypt_bar(
    bar_id: str,
    request: DecryptRequest,
    req: Request,                                          # needed for IP + rate-limiting
    file_service: FileService = Depends(get_file_service_dep),
    encryption_service: EncryptionService = Depends(get_encryption_service_dep)
):
    """
    Decrypt and extract a file from a client-side .bar container.

    Security controls
    -----------------
    * **Rate limit** – max ``_DECRYPT_RATE_LIMIT`` requests per IP per minute.
      Combined with the PBKDF2 KDF cost inside the encryption service this
      makes parallelised dictionary attacks impractical.
    * **Brute-force lockout** – failed password attempts are tracked per
      (IP, bar_id) pair.  After ``MAX_PASSWORD_ATTEMPTS`` failures the IP is
      locked out for ``LOCKOUT_DURATION_MINUTES`` minutes.
    * **Progressive delay** – each failed attempt increases the response
      delay exponentially (1 s → 2 s → 4 s → … capped at 30 s) to slow
      sequential attackers even before the hard lockout kicks in.
    * **Webhook alerting** – wrong-password and tamper-detection events are
      forwarded to any configured webhook URL so the file owner is notified.
    """
    try:
        # ------------------------------------------------------------------ #
        # 1. Rate limiting – must be the very first check so an attacker      #
        #    cannot bypass it by triggering an early 404.                     #
        # ------------------------------------------------------------------ #
        security.check_rate_limit(req, limit=_DECRYPT_RATE_LIMIT)

        # ------------------------------------------------------------------ #
        # 2. Resolve bar file — UUID4 format validation, exact-path lookup,   #
        #    path-traversal containment check, and file-existence check are    #
        #    all performed inside get_bar_file_path (C-05 fix).  The secondary #
        #    os.path.exists() guard below is a TOCTOU belt-and-suspenders      #
        #    check: the file could be concurrently deleted between the isfile  #
        #    check inside get_bar_file_path and the open() call at step 3.    #
        # ------------------------------------------------------------------ #
        bar_file = file_service.get_bar_file_path(bar_id)

        if not bar_file or not os.path.exists(bar_file):
            raise HTTPException(status_code=404, detail="BAR file not found or already destroyed")

        # ------------------------------------------------------------------ #
        # 3. Read file data                                                    #
        # ------------------------------------------------------------------ #
        with open(bar_file, "rb") as f:
            bar_data = f.read()

        # ------------------------------------------------------------------ #
        # 4. Brute-force check + progressive delay                            #
        #    Done AFTER we confirm the file exists so the attempt counter     #
        #    is tied to a real resource and the bar_id cannot be used as an   #
        #    oracle for file existence (the 404 above has already returned).  #
        # ------------------------------------------------------------------ #
        client_ip = analytics.get_client_ip(req)

        try:
            failed_count = await security.check_and_delay_password_attempt(client_ip, bar_id)
            if failed_count > 0:
                logger.warning(
                    '[%s] IP %s has %d previous failed attempt(s) — delay applied',
                    bar_id, client_ip, failed_count,
                )
        except HTTPException as lockout_exc:
            logger.warning(
                '[%s] IP %s is locked out (%s)',
                bar_id, client_ip, lockout_exc.detail,
            )
            raise

        # ------------------------------------------------------------------ #
        # 5. Decrypt (guarded by semaphore to cap concurrent memory usage)     #
        # ------------------------------------------------------------------ #
        password_to_use = request.password if request.password and request.password.strip() else None

        await decrypt_semaphore.acquire()
        try:
            decrypted_data, metadata, key, _enc, _salt = encryption_service.decrypt_bar_file(bar_data, password_to_use)
        except HTTPException as decrypt_exc:
            # Wrong password (403) – record the failure so the brute-force
            # counter advances and the progressive delay grows.
            if decrypt_exc.status_code == 403:
                security.record_password_attempt(client_ip, False, bar_id)
                logger.warning('[%s] Wrong password from %s', bar_id, client_ip)

                # Notify the file owner via webhook if one is configured.
                # We deliberately read the webhook URL from the raw bar_data
                # header rather than the fully-decrypted metadata to avoid
                # leaking file contents on auth failure.
                try:
                    raw_meta = _peek_metadata(bar_data)
                    webhook_url = raw_meta.get("webhook_url") if raw_meta else None
                    if webhook_url:
                        webhook_srv = webhook_service.get_webhook_service()
                        asyncio.create_task(webhook_srv.send_access_denied_alert(
                            webhook_url=webhook_url,
                            filename=raw_meta.get("filename", "unknown"),
                            reason="Invalid password (client-side decrypt)",
                            ip_address=client_ip,
                        ))
                except Exception:
                    pass  # Never let webhook failures surface to the caller
            raise

        except Exception as tamper_exc:
            # Any other low-level exception during decryption is most likely a
            # tamper / integrity failure.  Still record a failed attempt so the
            # lockout counter increments, and fire a tamper webhook.
            security.record_password_attempt(client_ip, False, bar_id)
            logger.warning(
                '[%s] Possible tamper detected from %s: %s',
                bar_id, client_ip, tamper_exc,
            )

            try:
                raw_meta = _peek_metadata(bar_data)
                webhook_url = raw_meta.get("webhook_url") if raw_meta else None
                if webhook_url:
                    webhook_srv = webhook_service.get_webhook_service()
                    asyncio.create_task(webhook_srv.send_tamper_alert(
                        webhook_url=webhook_url,
                        filename=raw_meta.get("filename", "unknown"),
                        token=bar_id,
                    ))
            except Exception:
                pass

            raise HTTPException(
                status_code=403,
                detail="File integrity check failed — possible tampering detected"
            )

        finally:
            decrypt_semaphore.release()

        # ------------------------------------------------------------------ #
        # 6. Successful decryption — clear brute-force counter                #
        # ------------------------------------------------------------------ #
        if metadata.get("password_protected"):
            security.record_password_attempt(client_ip, True, bar_id)
            logger.info('[%s] Correct password from %s', bar_id, client_ip)

        # ------------------------------------------------------------------ #
        # 7. Update view count and handle destruction (CWE-362 fix)           #
        # ------------------------------------------------------------------ #
        # The view-count read → increment → write/destroy cycle is a classic
        # TOCTOU race: two concurrent requests can both read current_views = N,
        # both compute N+1, and the file silently loses one increment —
        # breaking the burn-after-read guarantee for max_views files.
        #
        # Fix: hold a per-bar_id asyncio.Lock around the entire cycle and
        # **re-read the file from disk inside the lock** so the current_views
        # snapshot is authoritative.  We use peek_bar_metadata (JSON parse
        # only, zero PBKDF2 cost) to obtain the fresh view count.
        #
        # The decrypted_data returned to the caller was derived from the
        # pre-lock read, which is fine — the file content does not change
        # between views; only the view counter does.
        max_views = metadata.get("max_views", 0)
        file_lock = await _acquire_file_lock(bar_id)
        try:
            async with file_lock:
                # ── Re-read the file under the lock ──────────────────────
                # Another request may have incremented or destroyed the
                # file between our initial read and the lock acquisition.
                try:
                    with open(bar_file, "rb") as f:
                        fresh_bar_data = f.read()
                except FileNotFoundError:
                    # Destroyed by a concurrent request that won the lock
                    # before us.  The file is gone; report 410.
                    raise HTTPException(
                        status_code=410,
                        detail="File not found or already destroyed"
                    )

                # Re-derive current_views from the freshly-read bytes.
                # peek_bar_metadata is a lightweight JSON parse with zero
                # crypto cost (no PBKDF2, no HMAC, no Fernet) — it reads
                # the plaintext metadata header that sits outside the
                # encrypted payload.
                try:
                    fresh_metadata = crypto_utils.peek_bar_metadata(
                        fresh_bar_data
                    )
                except (ValueError, KeyError) as parse_err:
                    # The file is unreadable (corrupted / truncated mid-write
                    # by a prior crash).  Do NOT fall back to stale metadata:
                    # that would silently reset the view counter.  Surface a
                    # 500 so the operator can investigate.
                    logger.error(
                        '[%s] Cannot read metadata from on-disk BAR file '
                        'inside view-count lock: %s',
                        bar_id, parse_err,
                    )
                    raise HTTPException(
                        status_code=500,
                        detail=security.OPAQUE_500_DETAIL,
                    )

                current_views = fresh_metadata.get("current_views", 0) + 1
                should_destroy = (
                    max_views > 0 and current_views >= max_views
                )

                if not should_destroy:
                    # update_bar_view_count is the single authoritative
                    # entry point for persisting a view-count change.
                    # See its docstring for why pack_bar_file is not
                    # reused here.
                    #
                    # ValueError signals a legacy pre-HMAC file — skip
                    # the write but still serve the content.
                    try:
                        updated_bar = crypto_utils.update_bar_view_count(
                            fresh_bar_data, key
                        )
                        _atomic_write(bar_file, updated_bar)
                    except ValueError as legacy_err:
                        logger.warning(
                            '[%s] View-count not persisted (legacy unsigned '
                            'file): %s',
                            bar_id, legacy_err,
                        )
                else:
                    # Destroy the file — view limit reached.
                    crypto_utils.delete_file(bar_file)
                    logger.info(
                        '[%s] File destroyed after reaching max views',
                        bar_id,
                    )
        finally:
            await _release_file_lock(bar_id)

        # ------------------------------------------------------------------ #
        # 8. Return decrypted file                                             #
        # ------------------------------------------------------------------ #
        original_filename = metadata.get("filename", "decrypted_file")
        views_remaining = max(0, metadata.get("max_views", 0) - current_views)

        response = StreamingResponse(
            iter_bytes(decrypted_data),
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": security.build_content_disposition(original_filename, 'attachment'),
                "X-BAR-Views-Remaining": str(views_remaining),
                "X-BAR-Destroyed": str(should_destroy).lower(),
            },
        )
        return security.add_security_headers(response)

    except HTTPException:
        raise
    except Exception:
        logger.exception("Unhandled error in decrypt_bar [bar_id=%s]", bar_id)
        raise HTTPException(status_code=500, detail=security.OPAQUE_500_DETAIL)


# --------------------------------------------------------------------------- #
# Internal helpers                                                             #
# --------------------------------------------------------------------------- #

def _peek_metadata(bar_data: bytes) -> dict:
    """
    Attempt to extract the *unencrypted* metadata header from raw .bar bytes
    without performing full decryption.

    The function is best-effort: it returns an empty dict on any failure so
    callers never have to worry about exceptions from this helper.  Its only
    purpose is to retrieve the ``webhook_url`` and ``filename`` fields for
    alerting on auth failures where we don't have the decrypted metadata yet.
    """
    try:
        return crypto_utils.peek_bar_metadata(bar_data)
    except Exception:
        return {}


@router.post("/decrypt-upload")
async def decrypt_uploaded_bar_file(
    req: Request,
    file: UploadFile = File(...),
    password: str = Form(""),
    encryption_service: EncryptionService = Depends(get_encryption_service_dep)
):
    """Decrypt a .bar file that was uploaded directly (tracks view count properly)."""
    try:
        # Rate limit
        security.check_rate_limit(req, limit=20)
        
        # Basic file validation — guard None filename before calling .lower()
        if not file.filename or not file.filename.lower().endswith('.bar'):
            raise HTTPException(status_code=400, detail="Only .bar files are accepted")
        
        # Streaming size validation (prevents memory exhaustion)
        file_size = await security.validate_file_size_streaming(file, settings.max_file_size)
        logger.info('File size validated: %.2f MB', file_size / (1024 * 1024))
        
        # Now safe to read entire file
        bar_data = await file.read()
        
        # Get client IP for brute force tracking
        client_ip = analytics.get_client_ip(req)
        
        # Generate a stable pseudo-token from the full file bytes for brute-force
        # tracking.  Using only bar_data[:100] was fragile: the first 100 bytes
        # of every .bar file share the same fixed header ("BAR_FILE_V1\n" + start
        # of a deterministic base64 prefix), so small or identically-sized files
        # could collide and share a lockout bucket with unrelated files.  SHA-256
        # of the entire content is a true file-identity fingerprint.
        file_token = hashlib.sha256(bar_data).hexdigest()[:16]
        
        # Check brute force protection
        try:
            failed_count = await security.check_and_delay_password_attempt(client_ip, file_token)
            if failed_count > 0:
                logger.warning(
                    'Previous failed attempts: %d for file token %s — applying delay',
                    failed_count, file_token,
                )
        except HTTPException as e:
            logger.warning('IP %s is locked out for file token %s', client_ip, file_token)
            raise
        
        # Decrypt BAR file (guarded by semaphore to cap concurrent memory)
        password_to_use = password if password and password.strip() else None
        
        await decrypt_semaphore.acquire()
        try:
            decrypted_data, metadata, key, _enc, _salt = encryption_service.decrypt_bar_file(bar_data, password_to_use)
        except HTTPException as e:
            if e.status_code == 403:
                security.record_password_attempt(client_ip, False, file_token)

                # decrypt_bar_file() maps both "wrong password" and
                # "genuine tampering" to HTTPException(403).  We distinguish
                # them by the detail string so we can fire the correct webhook
                # and log the correct event.
                is_wrong_password = (
                    "Invalid password" in e.detail
                    or "Password required" in e.detail
                )
                try:
                    raw_meta = _peek_metadata(bar_data)
                    webhook_url = raw_meta.get("webhook_url") if raw_meta else None
                    if webhook_url:
                        webhook_srv = webhook_service.get_webhook_service()
                        if is_wrong_password:
                            asyncio.create_task(webhook_srv.send_access_denied_alert(
                                webhook_url=webhook_url,
                                filename=raw_meta.get("filename", "unknown"),
                                reason=f"{e.detail} (client-side decrypt)",
                                ip_address=client_ip,
                            ))
                        else:
                            # Tamper or corruption — fire tamper alert
                            asyncio.create_task(webhook_srv.send_tamper_alert(
                                webhook_url=webhook_url,
                                filename=raw_meta.get("filename", "unknown"),
                                token=file_token,
                            ))
                except Exception:
                    pass  # Never let webhook failures mask the auth error
            raise
        finally:
            decrypt_semaphore.release()
        
        # Validate access — expiry and presence of password string only.
        # NOTE: crypto_utils.unpack_bar_file() (called inside decrypt_bar_file)
        # validates the password via PBKDF2-HMAC-SHA256 key derivation + the
        # structural HMAC signature.  A wrong password produces a wrong key,
        # the HMAC check fails, and decrypt_bar_file raises HTTPException(403,
        # "Invalid password").  If we reached here the password (if any) is
        # correct.  validate_client_access therefore only checks expiry; its
        # password presence check is a belt-and-suspenders guard that should
        # never fail at this point.
        is_valid, errors = client_storage.validate_client_access(metadata, password_to_use)

        if not is_valid:
            error_msg = "; ".join(errors)
            # Only record a brute-force failure for errors that are not caused
            # by an expired file — expiry is not a password mistake.
            if any(e for e in errors if "password" in e.lower()):
                security.record_password_attempt(client_ip, False, file_token)
            raise HTTPException(status_code=403, detail=error_msg)
        
        # Record successful password attempt
        if metadata.get('password_protected'):
            security.record_password_attempt(client_ip, True, file_token)
        
        logger.info('Access granted (client-side — view limits NOT enforced)')
        
        # Return file data (streamed in chunks for backpressure)
        return StreamingResponse(
            iter_bytes(decrypted_data),
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": security.build_content_disposition(metadata.get('filename', 'decrypted_file'), 'attachment'),
                "X-BAR-Views-Remaining": "0",
                "X-BAR-Should-Destroy": "false",
                "X-BAR-View-Only": str(metadata.get('view_only', False)).lower(),
                "X-BAR-Filename": security.sanitize_header_value(metadata.get("filename", "decrypted_file")),
                # Only allowlisted, non-sensitive fields are included.
                # Sensitive keys (password_hash, webhook_url, file_hash,
                # encryption_method) are stripped inside build_safe_metadata_header
                # before the value ever leaves the server.  See core/security.py
                # for the full allowlist and the rationale for choosing an
                # allowlist over a denylist.
                "X-BAR-Metadata": security.build_safe_metadata_header(metadata),
            }
        )
        
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unhandled error in decrypt_uploaded_bar_file")
        raise HTTPException(status_code=500, detail=security.OPAQUE_500_DETAIL)
