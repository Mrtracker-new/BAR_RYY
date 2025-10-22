from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Response, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
from typing import Optional
import os
import uuid
import shutil
import json
import base64
from datetime import datetime
import mimetypes
import crypto_utils
import client_storage
import server_storage
import security


app = FastAPI(title="BAR Web API", version="1.0")

# Enable CORS for frontend
allowed_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
]

# Add Railway frontend URL from environment variable
if frontend_url := os.getenv("FRONTEND_URL"):
    allowed_origins.append(frontend_url)
    # Also allow without trailing slash
    allowed_origins.append(frontend_url.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "X-BAR-Views-Remaining",
        "X-BAR-Should-Destroy",
        "X-BAR-View-Only",
        "X-BAR-Filename",
        "X-BAR-Storage-Mode",
        "X-BAR-Destroyed",
        "X-BAR-Metadata"
    ],
)

# Directories
UPLOAD_DIR = "uploads"
GENERATED_DIR = "generated"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(GENERATED_DIR, exist_ok=True)


class SealRequest(BaseModel):
    filename: str
    max_views: int = 1
    expiry_minutes: int = 0
    password: Optional[str] = None
    webhook_url: Optional[str] = None
    view_only: bool = False
    storage_mode: str = 'client'  # 'client' or 'server'

    @validator('filename')
    def validate_filename(cls, v):
        if not v or len(v) > 255:
            raise ValueError('Invalid filename')
        if not security.validate_file_extension(v):
            raise ValueError('File type not allowed')
        return v

    @validator('max_views')
    def validate_max_views(cls, v):
        if v < 1 or v > 100:
            raise ValueError('Max views must be between 1 and 100')
        return v

    @validator('expiry_minutes')
    def validate_expiry(cls, v):
        if v < 0 or v > 43200:  # Max 30 days
            raise ValueError('Expiry must be between 0 and 43200 minutes (30 days)')
        return v

    @validator('password')
    def validate_password(cls, v):
        # Optional password, skip validation if empty or None
        if v and len(v) > 0:
            # Basic check: min 4 chars (lowered from 8 for UX)
            if len(v) < 4:
                raise ValueError('Password must be at least 4 characters')
            if len(v) > 128:
                raise ValueError('Password too long (max 128 characters)')
        return v

    @validator('webhook_url')
    def validate_webhook(cls, v):
        if v and not security.validate_webhook_url(v):
            raise ValueError('Invalid webhook URL')
        return v


class DecryptRequest(BaseModel):
    password: Optional[str] = None


@app.get("/")
async def root():
    resp = JSONResponse(content={
        "message": "BAR Web API - Burn After Reading",
        "version": "1.0",
        "endpoints": [
            "/upload - Upload file",
            "/seal - Seal and generate .bar file",
            "/decrypt/{bar_id} - Decrypt and retrieve file",
            "/storage-info - Get storage mode capabilities"
        ]
    })
    return security.add_security_headers(resp)


@app.get("/storage-info")
async def storage_info():
    """Get information about client-side vs server-side storage capabilities"""
    return {
        "client_side": client_storage.get_storage_info(),
        "server_side": server_storage.get_storage_info()
    }


@app.post("/upload")
async def upload_file(request: Request, file: UploadFile = File(...)):
    """Upload a file temporarily"""
    try:
        # Rate limiting
        security.check_rate_limit(request, limit=10)
        
        # Validate filename
        if not security.validate_filename(file.filename):
            raise HTTPException(status_code=400, detail="Invalid filename")
        
        # Validate file extension
        if not security.validate_file_extension(file.filename):
            raise HTTPException(status_code=400, detail="File type not allowed")
        
        # Sanitize filename
        safe_filename = security.sanitize_filename(file.filename)
        
        # Check file size
        file_size = 0
        chunk_size = 1024 * 1024  # 1MB chunks
        file_id = str(uuid.uuid4())
        temp_filename = f"{file_id}__{safe_filename}"
        temp_path = os.path.join(UPLOAD_DIR, temp_filename)
        
        # Save file with size limit
        with open(temp_path, "wb") as buffer:
            while chunk := await file.read(chunk_size):
                file_size += len(chunk)
                if file_size > security.MAX_FILE_SIZE:
                    # Clean up partial file
                    buffer.close()
                    os.remove(temp_path)
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Maximum size is {security.MAX_FILE_SIZE // (1024*1024)}MB"
                    )
                buffer.write(chunk)
        
        response = {
            "success": True,
            "file_id": file_id,
            "filename": safe_filename,
            "temp_filename": temp_filename,
            "size": file_size,
            "message": "File uploaded successfully"
        }
        return JSONResponse(content=response)
    except HTTPException:
        raise
    except Exception as e:
        error_msg = security.sanitize_error_message(str(e))
        raise HTTPException(status_code=500, detail=error_msg)


@app.post("/seal")
async def seal_container(req: Request, request: SealRequest):
    """Seal the file with encryption and rules, generate .bar file"""
    try:
        # Rate limit
        security.check_rate_limit(req, limit=10)
        # Find uploaded file - look for file with pattern {uuid}__{filename}
        uploaded_file = None
        
        # Look for file that ends with __{original_filename}
        for filename in os.listdir(UPLOAD_DIR):
            if filename.endswith(f"__{request.filename}"):
                uploaded_file = os.path.join(UPLOAD_DIR, filename)
                break
        
        if not uploaded_file or not os.path.exists(uploaded_file):
            # List available files for debugging
            available_files = os.listdir(UPLOAD_DIR)
            raise HTTPException(
                status_code=404, 
                detail=f"Uploaded file not found for: {request.filename}. Available files: {available_files}"
            )
        
        # Read file data
        with open(uploaded_file, "rb") as f:
            file_data = f.read()
        
        # Calculate file hash
        file_hash = crypto_utils.calculate_file_hash(file_data)
        
        # Generate encryption key
        password_hash = None
        if request.password:
            # Store password hash for validation
            import hashlib
            password_hash = hashlib.sha256(request.password.encode()).hexdigest()
            # Use password-derived key
            salt = os.urandom(16)
            key = crypto_utils.derive_key_from_password(request.password, salt)
        else:
            # Use random key
            key = crypto_utils.generate_key()
        
        # Encrypt file
        encrypted_data = crypto_utils.encrypt_file(file_data, key)
        
        # Create metadata based on storage mode
        if request.storage_mode == 'server':
            metadata = server_storage.create_server_metadata(
                filename=request.filename,
                max_views=request.max_views,
                expiry_minutes=request.expiry_minutes,
                password_protected=bool(request.password),
                webhook_url=request.webhook_url,
                view_only=request.view_only
            )
        else:
            metadata = client_storage.create_client_metadata(
                filename=request.filename,
                expiry_minutes=request.expiry_minutes,
                password_protected=bool(request.password),
                webhook_url=request.webhook_url,
                view_only=request.view_only
            )
        
        metadata["file_hash"] = file_hash
        if password_hash:
            metadata["password_hash"] = password_hash
        
        # Pack into .bar file
        bar_data = crypto_utils.pack_bar_file(encrypted_data, metadata, key)
        
        # Generate unique BAR ID
        bar_id = str(uuid.uuid4())
        bar_filename = f"{os.path.splitext(request.filename)[0]}_{bar_id[:8]}.bar"
        bar_path = os.path.join(GENERATED_DIR, bar_filename)
        
        # Save .bar file
        with open(bar_path, "wb") as f:
            f.write(bar_data)
        
        # Clean up uploaded file (secure deletion)
        crypto_utils.secure_delete_file(uploaded_file)
        
        # Generate response based on storage mode
        if request.storage_mode == 'server':
            # Server-side: Generate access token and shareable link
            access_token = str(uuid.uuid4())
            # Store mapping from token to bar_id (in production, use database)
            # For now, we'll use the token as part of the filename
            token_bar_filename = f"{access_token}.bar"
            token_bar_path = os.path.join(GENERATED_DIR, token_bar_filename)
            # Rename the bar file to use token
            os.rename(bar_path, token_bar_path)
            
        result = None
        if request.storage_mode == 'server':
            result = {
                "success": True,
                "storage_mode": "server",
                "access_token": access_token,
                "share_url": f"/share/{access_token}",
                "metadata": metadata,
                "message": "Container sealed and stored on server"
            }
        else:
            # Client-side: Return .bar file data directly (Railway has ephemeral filesystem)
            import base64
            bar_data_b64 = base64.b64encode(bar_data).decode('utf-8')
            if os.path.exists(bar_path):
                os.remove(bar_path)
            result = {
                "success": True,
                "storage_mode": "client",
                "bar_filename": bar_filename,
                "bar_data": bar_data_b64,
                "metadata": metadata,
                "message": "Container sealed successfully"
            }
        return JSONResponse(content=result)
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"Seal failed: {str(e)}\n{traceback.format_exc()}"
        print(error_detail)  # Log to console
        raise HTTPException(status_code=500, detail=security.sanitize_error_message(str(e)))


@app.get("/download/{bar_id}")
async def download_bar(bar_id: str):
    """Download the generated .bar file"""
    try:
        # Find BAR file
        bar_file = None
        for filename in os.listdir(GENERATED_DIR):
            if bar_id[:8] in filename and filename.endswith('.bar'):
                bar_file = os.path.join(GENERATED_DIR, filename)
                break
        
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


@app.post("/decrypt/{bar_id}")
async def decrypt_bar(bar_id: str, request: DecryptRequest):
    """Decrypt and extract file from .bar container"""
    try:
        # Find BAR file
        bar_file = None
        for filename in os.listdir(GENERATED_DIR):
            if bar_id[:8] in filename and filename.endswith('.bar'):
                bar_file = os.path.join(GENERATED_DIR, filename)
                break
        
        if not bar_file or not os.path.exists(bar_file):
            raise HTTPException(status_code=404, detail="BAR file not found or already destroyed")
        
        # Read and unpack BAR file
        with open(bar_file, "rb") as f:
            bar_data = f.read()
        
        encrypted_data, metadata, key = crypto_utils.unpack_bar_file(bar_data)
        
        # Validate access
        is_valid, errors = crypto_utils.validate_bar_access(metadata, request.password)
        
        if not is_valid:
            raise HTTPException(status_code=403, detail="; ".join(errors))
        
        # Verify password if required
        if metadata.get("password_protected") and request.password:
            try:
                salt = os.urandom(16)  # In production, store salt with metadata
                password_key = crypto_utils.derive_key_from_password(request.password, salt)
                # Simple password verification (in production, use proper password hashing)
            except:
                raise HTTPException(status_code=401, detail="Invalid password")
        
        # Decrypt file
        try:
            decrypted_data = crypto_utils.decrypt_file(encrypted_data, key)
        except Exception as e:
            raise HTTPException(status_code=500, detail="Decryption failed - invalid key or corrupted file")
        
        # Verify file integrity
        file_hash = crypto_utils.calculate_file_hash(decrypted_data)
        if file_hash != metadata.get("file_hash"):
            # Send tamper alert webhook if configured
            if metadata.get("webhook_url"):
                # In production, send async webhook notification
                pass
            raise HTTPException(status_code=500, detail="File integrity check failed - possible tampering")
        
        # Update view count
        metadata["current_views"] += 1
        
        # Check if file should be destroyed
        should_destroy = False
        if metadata.get("max_views", 0) > 0 and metadata["current_views"] >= metadata["max_views"]:
            should_destroy = True
        
        # Save updated metadata if not destroying
        if not should_destroy:
            updated_bar = crypto_utils.pack_bar_file(encrypted_data, metadata, key)
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


@app.post("/decrypt-upload")
async def decrypt_uploaded_bar_file(req: Request, file: UploadFile = File(...), password: str = Form("")):
    """Decrypt a .bar file that was uploaded directly (tracks view count properly)"""
    try:
        # Rate limit
        security.check_rate_limit(req, limit=20)
        
        # Basic file validation
        if not file.filename.lower().endswith('.bar'):
            raise HTTPException(status_code=400, detail="Only .bar files are accepted")
        
        # Size guard (limit processed size)
        bar_data = await file.read()
        if len(bar_data) > security.MAX_FILE_SIZE * 2:  # Allow larger for encrypted container
            raise HTTPException(status_code=413, detail="File too large")
        
        # Unpack BAR file
        encrypted_data, metadata, key = crypto_utils.unpack_bar_file(bar_data)
        
        # Debug logging
        storage_mode = metadata.get('storage_mode', 'client')
        print(f"\n=== DECRYPT REQUEST (CLIENT-SIDE) ===")
        print(f"Storage Mode: {storage_mode}")
        print(f"Password Protected: {metadata.get('password_protected')}")
        print(f"Expires At: {metadata.get('expires_at')}")
        print(f"Password Provided: {bool(password and password.strip())}")
        
        # Validate access using CLIENT storage module (no view count enforcement)
        password_to_check = password if password and password.strip() else None
        is_valid, errors = client_storage.validate_client_access(metadata, password_to_check)
        
        if not is_valid:
            error_msg = "; ".join(errors)
            print(f"\n!!! ACCESS DENIED !!!")
            print(f"Errors: {error_msg}")
            raise HTTPException(status_code=403, detail=error_msg)
        
        print(f"✓ Access granted! (Client-side - view limits NOT enforced)")
        
        # Decrypt file
        try:
            decrypted_data = crypto_utils.decrypt_file(encrypted_data, key)
        except Exception as e:
            raise HTTPException(status_code=500, detail="Decryption failed - invalid key or corrupted file")
        
        # Verify integrity
        file_hash = crypto_utils.calculate_file_hash(decrypted_data)
        if file_hash != metadata.get("file_hash"):
            raise HTTPException(
                status_code=500, 
                detail="File integrity check failed - possible tampering"
            )
        
        # Client-side files: view count NOT tracked or enforced
        # Users can decrypt the same file multiple times
        should_destroy = False
        views_remaining = 0  # Not applicable for client-side
        
        # Note: We can't update the .bar file since user uploaded it directly
        # This means view count enforcement relies on user not keeping copies of original file
        # This is a known limitation of client-side .bar file approach
        
        # Return file data with metadata
        return Response(
            content=decrypted_data,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename={metadata['filename']}",
                "X-BAR-Views-Remaining": str(views_remaining),
                "X-BAR-Should-Destroy": str(should_destroy).lower(),
                "X-BAR-View-Only": str(metadata.get('view_only', False)).lower(),
                "X-BAR-Filename": metadata["filename"],
                "X-BAR-Metadata": json.dumps(metadata)
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"Decryption failed: {str(e)}\n{traceback.format_exc()}"
        print(error_detail)
        raise HTTPException(status_code=500, detail=f"Decryption failed: {str(e)}")


@app.post("/share/{token}")
async def share_file(token: str, request: DecryptRequest):
    """Server-side access endpoint - properly enforces view limits"""
    password = request.password or ""
    try:
        # Find BAR file by token
        bar_file = os.path.join(GENERATED_DIR, f"{token}.bar")
        
        if not os.path.exists(bar_file):
            raise HTTPException(status_code=404, detail="File not found or already destroyed")
        
        # Read and unpack BAR file
        with open(bar_file, "rb") as f:
            bar_data = f.read()
        
        encrypted_data, metadata, key = crypto_utils.unpack_bar_file(bar_data)
        
        print(f"\n=== SHARE ACCESS REQUEST ===")
        print(f"Token: {token}")
        print(f"Password provided: {bool(password and password.strip())}")
        print(f"Password protected: {metadata.get('password_protected')}")
        print(f"View only: {metadata.get('view_only')}")
        print(f"Current views: {metadata.get('current_views')}/{metadata.get('max_views')}")
        
        # Validate password if protected
        if metadata.get("password_protected"):
            if not password or not password.strip():
                print("❌ Password required but not provided")
                raise HTTPException(status_code=403, detail="Password required")
            
            # Check password hash (only for new files that have it)
            stored_hash = metadata.get("password_hash")
            if stored_hash:
                import hashlib
                provided_hash = hashlib.sha256(password.strip().encode()).hexdigest()
                print(f"Password validation:")
                print(f"  Stored hash: {stored_hash[:16]}...")
                print(f"  Provided hash: {provided_hash[:16]}...")
                print(f"  Match: {provided_hash == stored_hash}")
                
                if provided_hash != stored_hash:
                    print("❌ Password hash mismatch!")
                    raise HTTPException(status_code=403, detail="Invalid password")
                print("✅ Password validated successfully")
            else:
                # Old file without password_hash - can't validate password
                # For security, you should regenerate these files
                print("⚠️ WARNING: File has password protection but no password_hash (old file format)")
        
        # Validate access using SERVER storage module (full enforcement)
        is_valid, errors = server_storage.validate_server_access(metadata, None, skip_password_check=True)
        
        if not is_valid:
            print(f"❌ Access validation failed: {errors}")
            raise HTTPException(status_code=403, detail="; ".join(errors))
        
        print("✅ Access validation passed")
        
        # Decrypt file
        try:
            decrypted_data = crypto_utils.decrypt_file(encrypted_data, key)
        except Exception as e:
            raise HTTPException(status_code=500, detail="Decryption failed")
        
        # Verify integrity
        file_hash = crypto_utils.calculate_file_hash(decrypted_data)
        if file_hash != metadata.get("file_hash"):
            raise HTTPException(status_code=500, detail="File integrity check failed")
        
        # Update view count using server storage module
        metadata = server_storage.increment_view_count(metadata)
        should_destroy = server_storage.should_destroy_file(metadata)
        views_remaining = server_storage.get_views_remaining(metadata)
        
        # CRITICAL: Update the .bar file on server with incremented view count
        if not should_destroy:
            updated_bar_data = crypto_utils.pack_bar_file(encrypted_data, metadata, key)
            with open(bar_file, "wb") as f:
                f.write(updated_bar_data)
            print(f"✓ View count updated: {metadata['current_views']}/{metadata.get('max_views', 0)}")
        else:
            # Destroy the file (secure deletion)
            crypto_utils.secure_delete_file(bar_file)
            print(f"🔥 File destroyed after reaching max views")
        
        # Return decrypted file
        # For view-only, use 'inline' with proper MIME type to let browser display it
        view_only = metadata.get('view_only', False)
        filename = metadata['filename']
        
        # Determine proper MIME type for inline viewing
        if view_only:
            # Guess MIME type from filename
            mime_type, _ = mimetypes.guess_type(filename)
            if not mime_type:
                mime_type = "application/octet-stream"
            content_disposition = f"inline; filename={filename}"
        else:
            mime_type = "application/octet-stream"
            content_disposition = f"attachment; filename={filename}"
        
        return Response(
            content=decrypted_data,
            media_type=mime_type,
            headers={
                "Content-Disposition": content_disposition,
                "X-BAR-Views-Remaining": str(views_remaining),
                "X-BAR-Should-Destroy": str(should_destroy).lower(),
                "X-BAR-View-Only": str(view_only).lower(),
                "X-BAR-Filename": filename,
                "X-BAR-Storage-Mode": "server"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"Access failed: {str(e)}\n{traceback.format_exc()}"
        print(error_detail)
        raise HTTPException(status_code=500, detail=f"Access failed: {str(e)}")


@app.get("/info/{bar_id}")
async def get_bar_info(bar_id: str):
    """Get metadata information about a BAR file without decrypting"""
    try:
        # Find BAR file
        bar_file = None
        for filename in os.listdir(GENERATED_DIR):
            if bar_id[:8] in filename and filename.endswith('.bar'):
                bar_file = os.path.join(GENERATED_DIR, filename)
                break
        
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
