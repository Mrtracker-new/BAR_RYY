"""Seal endpoints for creating BAR files."""
import os
import base64
import logging
from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import JSONResponse, FileResponse

from models.schemas import SealRequest
from core import security
from services.file_service import FileService
from services.encryption_service import EncryptionService
from api.dependencies import get_file_service_dep, get_encryption_service_dep
from utils import crypto_utils
from services import qr_generator

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/seal")
async def seal_container(
    req: Request,
    request: SealRequest,
    file_service: FileService = Depends(get_file_service_dep),
    encryption_service: EncryptionService = Depends(get_encryption_service_dep)
):
    """Seal the file with encryption and rules, generate .bar file."""
    try:
        # Rate limit
        security.check_rate_limit(req, limit=10)
        
        # Resolve the uploaded file by its opaque temp_filename token.
        # This is an exact-path lookup — no directory scan, no suffix match.
        # The token was issued by /upload and validated by SealRequest before
        # we ever reach this line, so no user-controlled string hits the FS.
        uploaded_file = file_service.resolve_temp_file(request.temp_filename)
        
        if not uploaded_file:
            raise HTTPException(
                status_code=404,
                detail="Uploaded file not found. It may have already been sealed "
                       "or the session has expired."
            )
        
        # Derive the original safe display filename from the token.
        # Format: "<uuid4>__<safe_filename>"  (produced by save_uploaded_file)
        display_filename = request.temp_filename.split('__', 1)[1]
        
        # Read file data
        with open(uploaded_file, "rb") as f:
            file_data = f.read()
        
        # Create BAR file
        bar_result = await encryption_service.create_bar_file(
            file_data=file_data,
            filename=display_filename,
            max_views=request.max_views,
            expiry_minutes=request.expiry_minutes,
            password=request.password,
            webhook_url=request.webhook_url,
            view_only=request.view_only,
            storage_mode=request.storage_mode,
            require_otp=request.require_otp,
            otp_email=request.otp_email,
            view_refresh_minutes=request.view_refresh_minutes,
            auto_refresh_seconds=request.auto_refresh_seconds
        )
        
        # Remove the plaintext temp upload — AES-256 is the protection layer,
        # not overwriting (ineffective on SSDs / cloud block storage).
        crypto_utils.delete_file(uploaded_file)

        # Remove the upload sidecar (fix: timestamp is stored there).
        # The file_id is the UUID prefix of temp_filename before "__".
        upload_file_id = request.temp_filename.split('__', 1)[0]
        file_service.delete_upload_sidecar(upload_file_id)
        
        # Generate response based on storage mode
        if request.storage_mode == 'server':
            # Get frontend URL for share links
            from core.config import settings
            base_url = settings.frontend_url
            if not base_url:
                # Fallback to request origin
                base_url = req.headers.get("origin") or req.headers.get("referer") or "http://localhost:5173"
                try:
                    if base_url and "/" in base_url[8:]:
                        from urllib.parse import urlparse
                        parsed = urlparse(base_url)
                        base_url = f"{parsed.scheme}://{parsed.netloc}"
                except Exception:
                    pass
            
            # Process server-side file
            server_result = await encryption_service.create_server_side_file(
                bar_result=bar_result,
                filename=display_filename,
                require_otp=request.require_otp,
                otp_email=request.otp_email,
                frontend_base_url=base_url
            )
            
            # Generate QR code
            logo_path = os.path.join(os.path.dirname(__file__), "..", "..", "BAR_web.png")
            try:
                qr_base64 = qr_generator.generate_themed_qr(server_result["share_url"], logo_path)
            except Exception as e:
                logger.warning('Failed to generate themed QR code: %s', e)
                qr_base64 = qr_generator.generate_simple_qr(server_result["share_url"])
            
            if request.require_otp:
                logger.info('2FA enabled — OTP will be sent to: %s', request.otp_email)
            
            result = {
                "success": True,
                "storage_mode": "server",
                "access_token": server_result["access_token"],
                "share_url": server_result["share_url"],
                "qr_code": qr_base64,
                "analytics_url": f"/analytics/{server_result['access_token']}",
                "analytics_key": server_result["analytics_key"],
                "metadata": bar_result["metadata"],
                "message": "Container sealed and stored on server"
            }
        else:
            # Client-side: Return .bar file data directly.
            bar_data_b64 = base64.b64encode(bar_result["bar_data"]).decode('utf-8')

            # Remove the temporary .bar file from disk — the caller receives
            # it as base64 in the JSON body and the server copy is not needed.
            # AES-256 protects the ciphertext; overwriting is ineffective on
            # SSDs and cloud block storage (see crypto_utils.delete_file).
            if os.path.exists(bar_result["bar_path"]):
                crypto_utils.delete_file(bar_result["bar_path"])

            # Build the human-readable download filename the browser will use.
            # The on-disk filename is a bare UUID ("{bar_id}.bar") for security
            # reasons (no user-controlled data in the path), but that name is
            # meaningless to the recipient.  We expose the original display
            # filename + ".bar" as the suggested download name instead.
            # display_filename is already in scope from line 46 above.
            stem = os.path.splitext(display_filename)[0]
            download_filename = f"{stem}.bar"

            result = {
                "success": True,
                "storage_mode": "client",
                "bar_filename": download_filename,
                "bar_data": bar_data_b64,
                "metadata": bar_result["metadata"],
                "message": "Container sealed successfully"
            }
        
        return JSONResponse(content=result)
        
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unhandled error in seal_container")
        raise HTTPException(status_code=500, detail=security.OPAQUE_500_DETAIL)


@router.get("/download/{bar_id}")
async def download_bar(
    bar_id: str,
    file_service: FileService = Depends(get_file_service_dep)
):
    """Download the generated .bar file."""
    try:
        # get_bar_file_path validates UUID4 format, constructs the path
        # deterministically, applies a path-traversal containment guard, and
        # confirms the file exists — all before returning.  The secondary
        # os.path.exists() guard below is a TOCTOU belt-and-suspenders check
        # (the file could be deleted between the isfile() check inside
        # get_bar_file_path and the FileResponse open() call here).
        bar_file = file_service.get_bar_file_path(bar_id)

        if not bar_file or not os.path.exists(bar_file):
            raise HTTPException(status_code=404, detail="BAR file not found")

        # Derive the human-readable download filename from the BAR container's
        # embedded metadata.  The on-disk filename is a bare UUID ("{bar_id}.bar")
        # for security reasons — no user-controlled data in the path — but that
        # name is meaningless to the recipient.  peek_bar_metadata reads only
        # the unencrypted plaintext header (no key derivation, no HMAC check)
        # so it is fast and cannot fail due to a wrong password.
        # Fall back to the UUID-based name if metadata is unreadable.
        download_filename = os.path.basename(bar_file)  # safe fallback
        try:
            with open(bar_file, "rb") as f:
                bar_bytes = f.read()
            raw_meta = crypto_utils.peek_bar_metadata(bar_bytes)
            original_filename = raw_meta.get("filename", "")
            if original_filename:
                stem = os.path.splitext(original_filename)[0]
                download_filename = f"{stem}.bar"
        except Exception:
            # If metadata is unreadable (corrupt file, etc.) fall back silently.
            pass

        return FileResponse(
            bar_file,
            media_type="application/octet-stream",
            filename=download_filename,
            headers={"Content-Disposition": security.build_content_disposition(download_filename, 'attachment')}
        )

    except HTTPException:
        raise
    except Exception:
        logger.exception("Unhandled error in download_bar [bar_id=%s]", bar_id)
        raise HTTPException(status_code=500, detail=security.OPAQUE_500_DETAIL)


@router.get("/info/{bar_id}")
async def get_bar_info(
    req: Request,
    bar_id: str,
    file_service: FileService = Depends(get_file_service_dep),
):
    """Return a minimal, pre-decryption metadata preview for a BAR container.

    Security design — deliberate unauthenticated access
    ---------------------------------------------------
    This endpoint is intentionally public (no credential required).  The UX
    contract is: a recipient must be able to see *what* file they are about to
    decrypt — its name, whether a password is required, and when it expires —
    **before** they are asked to supply a password or consume a view.
    Requiring authentication here would break that flow entirely.

    Because the access is intentional, the following controls are in place to
    limit the attack surface:

    1. **Correct unpack primitive** — uses ``peek_bar_metadata()``, which only
       decodes the plaintext header (base64-decode + JSON parse).  It performs
       **no key derivation, no HMAC verification, and no Fernet decryption**.
       This means:
         • Password-protected files are handled identically to key_stored files.
         • No PBKDF2 work is triggered, so this endpoint cannot be used as a
           cheap oracle for timing-based key-derivation attacks.
         • A malformed / truncated file raises ``ValueError`` → clean 422, not
           a raw 500 that might leak implementation detail.

    2. **Minimal response surface** — only five non-sensitive, UX-essential
       fields are returned.  Specifically excluded:
         • ``max_views`` / ``current_views`` / any derived counter — these
           would reveal the exact access history of the file to any anonymous
           caller, which is a privacy leak against the sender's intent.
         • ``webhook_url``, ``file_hash``, ``encryption_method`` — always
           excluded; these are internal implementation fields that could aid
           an attacker in fingerprinting or replaying requests.

    3. **Per-IP rate limiting** — 30 requests/min per IP, matching the budget
       documented in ``security.RATE_LIMITS["/info/"]``.  This prevents bulk
       bar_id enumeration by bots.

    4. **UUID4 path guard** — ``get_bar_file_path()`` inside ``FileService``
       validates the ``bar_id`` path parameter as a strict UUID4 and applies a
       path-traversal containment check before any filesystem access occurs.

    Response fields (see table in ``RATE_LIMITS`` docstring for rationale):
        filename          — original file name (display only)
        created_at        — ISO-8601 creation timestamp
        expires_at        — ISO-8601 expiry timestamp, or None
        password_protected — bool; tells the UI to show the password field
        view_only         — bool; tells the UI to suppress the download button
    """
    try:
        # Rate-limit anonymous callers to prevent bar_id enumeration.
        # 30 req/min is generous for a human user, restrictive for a bot.
        security.check_rate_limit(req, limit=30)

        # get_bar_file_path validates UUID4 format, constructs the path
        # deterministically, applies a path-traversal containment guard, and
        # confirms the file exists — all before returning.  The secondary
        # os.path.exists() guard below is a TOCTOU belt-and-suspenders check
        # (the file could be deleted between the isfile() call inside
        # get_bar_file_path and this point).
        bar_file = file_service.get_bar_file_path(bar_id)

        if not bar_file or not os.path.exists(bar_file):
            raise HTTPException(status_code=404, detail="BAR file not found")

        # Read the raw .bar bytes — header-only parse follows.
        with open(bar_file, "rb") as f:
            bar_data = f.read()

        # peek_bar_metadata() decodes ONLY the plaintext header section.
        # It does NOT derive any key, NOT verify any HMAC, and NOT decrypt
        # any ciphertext.  This is the correct primitive for this endpoint:
        # we need display-only metadata, not the full decryption pipeline.
        #
        # Contrast with unpack_bar_file(), which would:
        #   • Fail with ValueError for password_derived files (no password given)
        #   • Perform PBKDF2 key derivation on key_stored files (unnecessary work)
        #   • Run HMAC verification (unnecessary work)
        # Using unpack_bar_file() here would be both wrong and wasteful.
        try:
            metadata = crypto_utils.peek_bar_metadata(bar_data)
        except ValueError as exc:
            # File exists on disk but the header is unreadable (corrupt or
            # wrong format).  Surface this as 422 Unprocessable Content rather
            # than a raw 500, so the caller gets actionable feedback without
            # exposing any internal traceback.
            logger.warning(
                "get_bar_info: peek_bar_metadata failed for bar_id=%s — %s",
                bar_id, exc
            )
            raise HTTPException(
                status_code=422,
                detail="BAR file header is unreadable or corrupt."
            )

        # Return the minimal UX-essential subset.
        # Fields deliberately excluded: max_views, current_views,
        # views_remaining (access counters — privacy), webhook_url,
        # file_hash, encryption_method (internal implementation fields).
        return {
            "filename": metadata.get("filename"),
            "created_at": metadata.get("created_at"),
            "expires_at": metadata.get("expires_at"),
            "password_protected": bool(metadata.get("password_protected", False)),
            "view_only": bool(metadata.get("view_only", False)),
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Unhandled error in get_bar_info [bar_id=%s]", bar_id)
        raise HTTPException(status_code=500, detail=security.OPAQUE_500_DETAIL)
