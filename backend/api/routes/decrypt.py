"""Decrypt endpoints."""
import os
import json
import hashlib
import asyncio
import traceback
from fastapi import APIRouter, Request, File, UploadFile, Form, Depends, HTTPException
from fastapi.responses import Response

from models.schemas import DecryptRequest
from core import security
from services.file_service import FileService
from services.encryption_service import EncryptionService
from api.dependencies import get_file_service_dep, get_encryption_service_dep
from utils import crypto_utils
from storage import client_storage
from services import analytics
from services import webhook_service

router = APIRouter()

# Rate-limit budget for the client-side decrypt endpoint.
# Kept intentionally low: each hit triggers PBKDF2 KDF work which is
# CPU-intensive, so an attacker who can flood us here gets a double win
# (guessing + DoS).  10 req/min per IP is more than enough for a legitimate
# human use-case while making automated dictionary attacks impractical even
# before the PBKDF2 cost is factored in.
_DECRYPT_RATE_LIMIT = 10  # requests per 60-second window per IP


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
        # 2. Resolve bar file                                                  #
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
                print(f"⚠️ [{bar_id}] IP {client_ip} has {failed_count} previous failed attempt(s) — delay applied")
        except HTTPException as lockout_exc:
            print(f"🚫 [{bar_id}] IP {client_ip} is locked out ({lockout_exc.detail})")
            raise

        # ------------------------------------------------------------------ #
        # 5. Decrypt                                                           #
        # ------------------------------------------------------------------ #
        password_to_use = request.password if request.password and request.password.strip() else None

        try:
            decrypted_data, metadata, key = encryption_service.decrypt_bar_file(bar_data, password_to_use)
        except HTTPException as decrypt_exc:
            # Wrong password (403) – record the failure so the brute-force
            # counter advances and the progressive delay grows.
            if decrypt_exc.status_code == 403:
                security.record_password_attempt(client_ip, False, bar_id)
                print(f"🔑 [{bar_id}] Wrong password from {client_ip}")

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
            print(f"🚨 [{bar_id}] Possible tamper detected from {client_ip}: {tamper_exc}")

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

        # ------------------------------------------------------------------ #
        # 6. Successful decryption — clear brute-force counter                #
        # ------------------------------------------------------------------ #
        if metadata.get("password_protected"):
            security.record_password_attempt(client_ip, True, bar_id)
            print(f"✅ [{bar_id}] Correct password from {client_ip}")

        # ------------------------------------------------------------------ #
        # 7. Update view count and handle destruction                          #
        # ------------------------------------------------------------------ #
        metadata["current_views"] += 1

        should_destroy = (
            metadata.get("max_views", 0) > 0
            and metadata["current_views"] >= metadata["max_views"]
        )

        if not should_destroy:
            # Re-encrypt with updated view count and persist.
            encrypted_data = crypto_utils.encrypt_file(
                crypto_utils.decrypt_file(
                    crypto_utils.encrypt_file(decrypted_data, key),
                    key
                ),
                key
            )
            updated_bar = crypto_utils.pack_bar_file(
                encrypted_data,
                metadata,
                key,
                password=request.password if metadata.get("password_protected") else None
            )
            with open(bar_file, "wb") as f:
                f.write(updated_bar)
        else:
            # Securely wipe the .bar file.
            crypto_utils.secure_delete_file(bar_file)
            print(f"🔥 [{bar_id}] File destroyed after reaching max views")

        # ------------------------------------------------------------------ #
        # 8. Return decrypted file                                             #
        # ------------------------------------------------------------------ #
        original_filename = metadata.get("filename", "decrypted_file")
        views_remaining = max(0, metadata.get("max_views", 0) - metadata["current_views"])

        response = Response(
            content=decrypted_data,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename={original_filename}",
                "X-BAR-Views-Remaining": str(views_remaining),
                "X-BAR-Destroyed": str(should_destroy).lower(),
            },
        )
        return security.add_security_headers(response)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Decryption failed: {str(e)}")


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
        
        # Basic file validation
        if not file.filename.lower().endswith('.bar'):
            raise HTTPException(status_code=400, detail="Only .bar files are accepted")
        
        # Streaming size validation (prevents memory exhaustion)
        file_size = await security.validate_file_size_streaming(file, security.MAX_FILE_SIZE)
        print(f"✓ File size validated: {file_size / (1024*1024):.2f}MB")
        
        # Now safe to read entire file
        bar_data = await file.read()
        
        # Get client IP for brute force tracking
        client_ip = analytics.get_client_ip(req)
        
        # Generate pseudo-token from file hash for tracking
        file_token = hashlib.sha256(bar_data[:100]).hexdigest()[:16]
        
        # Check brute force protection
        try:
            failed_count = await security.check_and_delay_password_attempt(client_ip, file_token)
            if failed_count > 0:
                print(f"⚠️ Previous failed attempts: {failed_count} - applying delay")
        except HTTPException as e:
            print(f"🚫 IP {client_ip} is locked out for file {file_token}")
            raise
        
        # Decrypt BAR file
        password_to_use = password if password and password.strip() else None
        
        try:
            decrypted_data, metadata, key = encryption_service.decrypt_bar_file(bar_data, password_to_use)
        except HTTPException as e:
            # Record failed attempt
            if e.status_code == 403:
                security.record_password_attempt(client_ip, False, file_token)
            raise
        except crypto_utils.TamperDetectedException as e:
            # Send tamper alert webhook if configured
            webhook_url = metadata.get("webhook_url")
            if webhook_url:
                webhook_srv = webhook_service.get_webhook_service()
                filename = metadata.get("filename", "unknown")
                asyncio.create_task(webhook_srv.send_tamper_alert(
                    webhook_url=webhook_url,
                    filename=filename,
                    token=file_token
                ))
            raise HTTPException(status_code=403, detail="File integrity check failed - possible tampering")
        
        # Validate access
        password_to_check = password if password and password.strip() else None
        is_valid, errors = client_storage.validate_client_access(metadata, password_to_check)
        
        if not is_valid:
            error_msg = "; ".join(errors)
            if "Password required" in error_msg and metadata.get('password_protected'):
                security.record_password_attempt(client_ip, False, file_token)
            raise HTTPException(status_code=403, detail=error_msg)
        
        # Record successful password attempt
        if metadata.get('password_protected'):
            security.record_password_attempt(client_ip, True, file_token)
        
        print(f"✓ Access granted! (Client-side - view limits NOT enforced)")
        
        # Return file data
        return Response(
            content=decrypted_data,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename={metadata['filename']}",
                "X-BAR-Views-Remaining": "0",
                "X-BAR-Should-Destroy": "false",
                "X-BAR-View-Only": str(metadata.get('view_only', False)).lower(),
                "X-BAR-Filename": metadata["filename"],
                "X-BAR-Metadata": json.dumps(metadata)
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        error_detail = f"Decryption failed: {str(e)}\n{traceback.format_exc()}"
        print(error_detail)
        raise HTTPException(status_code=500, detail=f"Decryption failed: {str(e)}")
