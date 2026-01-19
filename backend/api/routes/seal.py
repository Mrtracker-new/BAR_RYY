"""Seal endpoints for creating BAR files."""
import os
import base64
import traceback
from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import JSONResponse, FileResponse

from models.schemas import SealRequest
from core import security
from services.file_service import FileService
from services.encryption_service import EncryptionService
from api.dependencies import get_file_service_dep, get_encryption_service_dep
import crypto_utils
import qr_generator

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
        
        # Find uploaded file
        uploaded_file = file_service.find_uploaded_file(request.filename)
        
        if not uploaded_file or not os.path.exists(uploaded_file):
            available_files = os.listdir(file_service.upload_dir)
            raise HTTPException(
                status_code=404,
                detail=f"Uploaded file not found for: {request.filename}. Available files: {available_files}"
            )
        
        # Read file data
        with open(uploaded_file, "rb") as f:
            file_data = f.read()
        
        # Create BAR file
        bar_result = await encryption_service.create_bar_file(
            file_data=file_data,
            filename=request.filename,
            max_views=request.max_views,
            expiry_minutes=request.expiry_minutes,
            password=request.password,
            webhook_url=request.webhook_url,
            view_only=request.view_only,
            storage_mode=request.storage_mode,
            require_otp=request.require_otp,
            otp_email=request.otp_email
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
                filename=request.filename,
                require_otp=request.require_otp,
                otp_email=request.otp_email,
                frontend_base_url=base_url
            )
            
            # Generate QR code
            logo_path = os.path.join(os.path.dirname(__file__), "..", "..", "BAR_web.png")
            try:
                qr_base64 = qr_generator.generate_themed_qr(server_result["share_url"], logo_path)
            except Exception as e:
                print(f"Failed to generate themed QR code: {e}")
                qr_base64 = qr_generator.generate_simple_qr(server_result["share_url"])
            
            if request.require_otp:
                print(f"🔐 2FA enabled - OTP will be sent to: {request.otp_email}")
            
            result = {
                "success": True,
                "storage_mode": "server",
                "access_token": server_result["access_token"],
                "share_url": server_result["share_url"],
                "qr_code": qr_base64,
                "analytics_url": f"/analytics/{server_result['access_token']}",
                "analytics_token": server_result["access_token"],
                "metadata": bar_result["metadata"],
                "message": "Container sealed and stored on server"
            }
        else:
            # Client-side: Return .bar file data directly
            bar_data_b64 = base64.b64encode(bar_result["bar_data"]).decode('utf-8')
            if os.path.exists(bar_result["bar_path"]):
                os.remove(bar_result["bar_path"])
            
            result = {
                "success": True,
                "storage_mode": "client",
                "bar_filename": bar_result["bar_filename"],
                "bar_data": bar_data_b64,
                "metadata": bar_result["metadata"],
                "message": "Container sealed successfully"
            }
        
        return JSONResponse(content=result)
        
    except HTTPException:
        raise
    except Exception as e:
        error_detail = f"Seal failed: {str(e)}\n{traceback.format_exc()}"
        print(error_detail)
        raise HTTPException(status_code=500, detail=security.sanitize_error_message(str(e)))


@router.get("/download/{bar_id}")
async def download_bar(
    bar_id: str,
    file_service: FileService = Depends(get_file_service_dep)
):
    """Download the generated .bar file."""
    try:
        bar_file = file_service.get_bar_file_path(bar_id)
        
        if not bar_file or not os.path.exists(bar_file):
            raise HTTPException(status_code=404, detail="BAR file not found")
        
        return FileResponse(
            bar_file,
            media_type="application/octet-stream",
            filename=os.path.basename(bar_file),
            headers={"Content-Disposition": f"attachment; filename={os.path.basename(bar_file)}"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")


@router.get("/info/{bar_id}")
async def get_bar_info(
    bar_id: str,
    file_service: FileService = Depends(get_file_service_dep),
    encryption_service: EncryptionService = Depends(get_encryption_service_dep)
):
    """Get metadata information about a BAR file without decrypting."""
    try:
        bar_file = file_service.get_bar_file_path(bar_id)
        
        if not bar_file or not os.path.exists(bar_file):
            raise HTTPException(status_code=404, detail="BAR file not found")
        
        # Read and unpack BAR file
        with open(bar_file, "rb") as f:
            bar_data = f.read()
        
        _, metadata, _ = crypto_utils.unpack_bar_file(bar_data)
        
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
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Info retrieval failed: {str(e)}")
