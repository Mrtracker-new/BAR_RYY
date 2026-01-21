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
import crypto_utils
import client_storage
import analytics
import webhook_service

router = APIRouter()


@router.post("/decrypt/{bar_id}")
async def decrypt_bar(
    bar_id: str,
    request: DecryptRequest,
    file_service: FileService = Depends(get_file_service_dep),
    encryption_service: EncryptionService = Depends(get_encryption_service_dep)
):
    """Decrypt and extract file from .bar container."""
    try:
        # Find BAR file
        bar_file = file_service.get_bar_file_path(bar_id)
        
        if not bar_file or not os.path.exists(bar_file):
            raise HTTPException(status_code=404, detail="BAR file not found or already destroyed")
        
        # Read and decrypt BAR file
        with open(bar_file, "rb") as f:
            bar_data = f.read()
        
        decrypted_data, metadata, key = encryption_service.decrypt_bar_file(bar_data, request.password)
        
        # Update view count
        metadata["current_views"] += 1
        
        # Check if file should be destroyed
        should_destroy = False
        if metadata.get("max_views", 0) > 0 and metadata["current_views"] >= metadata["max_views"]:
            should_destroy = True
        
        # Save updated metadata if not destroying
        if not should_destroy:
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
            # Destroy the BAR file (secure deletion)
            crypto_utils.secure_delete_file(bar_file)
        
        # Return decrypted file
        original_filename = metadata.get("filename", "decrypted_file")
        response = Response(
            content=decrypted_data,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename={original_filename}",
                "X-BAR-Views-Remaining": str(max(0, metadata.get("max_views", 0) - metadata["current_views"])),
                "X-BAR-Destroyed": str(should_destroy).lower()
            }
        )
        return security.add_security_headers(response)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Decryption failed: {str(e)}")


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
            failed_count = security.check_and_delay_password_attempt(client_ip, file_token)
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
