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
        
        # Clean up uploaded file (secure deletion)
        crypto_utils.secure_delete_file(uploaded_file)
        
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

            # Securely wipe the temporary .bar file on disk.
            # The caller receives the content as base64 in the JSON body;
            # the server-side copy is no longer needed and must be wiped
            # (not just unlinked) because the ciphertext contains the
            # encryption key in key_stored mode.
            if os.path.exists(bar_result["bar_path"]):
                crypto_utils.secure_delete_file(bar_result["bar_path"])

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
    bar_id: str,
    file_service: FileService = Depends(get_file_service_dep),
    encryption_service: EncryptionService = Depends(get_encryption_service_dep)
):
    """Get metadata information about a BAR file without decrypting."""
    try:
        # get_bar_file_path validates UUID4 format, constructs the path
        # deterministically, applies a path-traversal containment guard, and
        # confirms the file exists — all before returning.  The secondary
        # os.path.exists() guard below is a TOCTOU belt-and-suspenders check.
        bar_file = file_service.get_bar_file_path(bar_id)

        if not bar_file or not os.path.exists(bar_file):
            raise HTTPException(status_code=404, detail="BAR file not found")

        # Read and unpack BAR file
        with open(bar_file, "rb") as f:
            bar_data = f.read()

        _, metadata, _, _salt = crypto_utils.unpack_bar_file(bar_data)

        # Return safe metadata (excluding encryption key)
        return {
            "filename": metadata.get("filename"),
            "created_at": metadata.get("created_at"),
            "expires_at": metadata.get("expires_at"),
            "max_views": metadata.get("max_views"),
            "current_views": metadata.get("current_views"),
            "password_protected": metadata.get("password_protected"),
            "views_remaining": max(0, metadata.get("max_views", 0) - metadata.get("current_views", 0))
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Unhandled error in get_bar_info [bar_id=%s]", bar_id)
        raise HTTPException(status_code=500, detail=security.OPAQUE_500_DETAIL)
