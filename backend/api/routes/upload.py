"""Upload endpoints."""
import logging
from fastapi import APIRouter, File, UploadFile, Request, Depends, HTTPException
from fastapi.responses import JSONResponse

from core import security
from core.config import settings
from services.file_service import FileService
from api.dependencies import get_file_service_dep
from storage import client_storage
from storage import server_storage

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/upload")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    file_service: FileService = Depends(get_file_service_dep)
):
    """Upload a file temporarily."""
    try:
        # Rate limiting
        security.check_rate_limit(request, limit=10)
        
        # Save uploaded file (includes validation)
        file_id, safe_filename, file_size, preview_data = await file_service.save_uploaded_file(file)
        
        response = {
            "success": True,
            "file_id": file_id,
            "filename": safe_filename,
            "temp_filename": f"{file_id}__{safe_filename}",
            "size": file_size,
            "preview": preview_data,
            "message": "File uploaded successfully"
        }
        return JSONResponse(content=response)
        
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unhandled error in upload_file")
        raise HTTPException(status_code=500, detail=security.OPAQUE_500_DETAIL)


@router.get("/storage-info")
async def storage_info():
    """Get information about client-side vs server-side storage capabilities."""
    return {
        "client_side": client_storage.get_storage_info(),
        "server_side": server_storage.get_storage_info()
    }
