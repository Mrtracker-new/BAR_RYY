from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Response, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import base64
from io import BytesIO
from pydantic import BaseModel, validator
from typing import Optional
import os
from dotenv import load_dotenv
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("⚠️ Pillow not installed - image previews will be disabled")

import qr_generator


# Load environment variables from .env file
load_dotenv()

import uuid
import shutil
import json
from datetime import datetime
import mimetypes
import crypto_utils
import client_storage
import server_storage
import security
import cleanup
import database
import analytics
import otp_service


app = FastAPI(title="BAR Web API", version="1.0")

# Enable CORS for frontend
allowed_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
]

# Add frontend URL from environment variable (Render/production)
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

# Start background cleanup task
@app.on_event("startup")
async def startup_event():
    """Start background tasks on app startup"""
    import asyncio
    # Initialize database
    await database.init_database()
    # Start cleanup task
    asyncio.create_task(cleanup.run_cleanup_loop())
    print("🚀 BAR Web API started with database and cleanup task")


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up on shutdown"""
    await database.close_database()
    print("👋 BAR Web API shutting down")


class SealRequest(BaseModel):
    filename: str
    max_views: int = 1
    expiry_minutes: int = 0
    password: Optional[str] = None
    webhook_url: Optional[str] = None
    view_only: bool = False
    storage_mode: str = 'client'  # 'client' or 'server'
    require_otp: bool = False  # Enable 2FA
    otp_email: Optional[str] = None  # Email for OTP delivery

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
    
    @validator('otp_email')
    def validate_otp_email(cls, v, values):
        # If OTP is required, email must be provided
        if values.get('require_otp') and not v:
            raise ValueError('Email address required when 2FA is enabled')
        # Basic email validation
        if v:
            import re
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(email_pattern, v):
                raise ValueError('Invalid email address')
        return v


class DecryptRequest(BaseModel):
    password: Optional[str] = None


class OTPRequest(BaseModel):
    token: str


class OTPVerifyRequest(BaseModel):
    token: str
    otp_code: str
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
        
        # Generate preview for images and videos
        preview_data = None
        if PIL_AVAILABLE and file.content_type:
            try:
                if file.content_type.startswith('image/'):
                    # Image preview
                    img = Image.open(temp_path)
                    # Create thumbnail (max 300x300)
                    img.thumbnail((300, 300), Image.Resampling.LANCZOS)
                    # Convert to base64
                    buffer_io = BytesIO()
                    img_format = img.format or 'PNG'
                    img.save(buffer_io, format=img_format)
                    preview_data = f"data:image/{img_format.lower()};base64," + base64.b64encode(buffer_io.getvalue()).decode()
                elif file.content_type.startswith('video/'):
                    # Video preview - attempt to extract first frame
                    # Note: This requires additional dependencies like opencv-python or moviepy
                    # For now, we'll skip video thumbnails to avoid heavy dependencies
                    print(f"Video upload detected: {safe_filename} - thumbnail generation skipped")
                    preview_data = None
            except Exception as e:
                print(f"Preview generation failed: {e}")
                preview_data = None
        
        response = {
            "success": True,
            "file_id": file_id,
            "filename": safe_filename,
            "temp_filename": temp_filename,
            "size": file_size,
            "preview": preview_data,
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
            # Server-side: Generate access token and save to database
            access_token = str(uuid.uuid4())
            token_bar_filename = f"{access_token}.bar"
            token_bar_path = os.path.join(GENERATED_DIR, token_bar_filename)
            # Rename the bar file to use token
            os.rename(bar_path, token_bar_path)
            
            # Save file record to database with 2FA settings
            await database.db.create_file_record(
                token=access_token,
                filename=request.filename,
                bar_filename=token_bar_filename,
                file_path=token_bar_path,
                metadata=metadata,
                require_otp=request.require_otp,
                otp_email=request.otp_email
            )
            print(f"✅ Server-side file created: {access_token}")

            # Generate full shareable link (absolute URL)
            share_link = f"http://localhost:8000/share/{access_token}"
            # Generate custom themed QR code with logo
            logo_path = os.path.join(os.path.dirname(__file__), "BAR_web.png")
            try:
                qr_base64 = qr_generator.generate_themed_qr(share_link, logo_path)
            except Exception as e:
                print(f"Failed to generate themed QR code: {e}")
                # Fallback to simple themed QR
                qr_base64 = qr_generator.generate_simple_qr(share_link)

            if request.require_otp:
                print(f"🔐 2FA enabled - OTP will be sent to: {request.otp_email}")
            
        result = None
        if request.storage_mode == 'server':
            result = {
                "success": True,
                "storage_mode": "server",
                "access_token": access_token,
                "share_url": share_link,
                "qr_code": qr_base64,
                "analytics_url": f"/analytics/{access_token}",
                "analytics_token": access_token,  # Same token for simplicity
                "metadata": metadata,
                "message": "Container sealed and stored on server"
            }
        else:
            # Client-side: Return .bar file data directly (ephemeral filesystem on Render/cloud)
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


@app.get("/check-2fa/{token}")
async def check_2fa(token: str):
    """Check if a file requires 2FA"""
    try:
        file_record = await database.db.get_file_record(token)
        
        if not file_record:
            raise HTTPException(status_code=404, detail="File not found")
        
        return {
            "require_otp": file_record.get('require_otp', False),
            "has_password": bool(file_record.get('metadata', {}).get('password_protected'))
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/request-otp/{token}")
async def request_otp(token: str, req: Request):
    """Request OTP code to be sent via email for 2FA-protected files"""
    try:
        # Rate limit
        security.check_rate_limit(req, limit=5)
        
        # Get file record
        file_record = await database.db.get_file_record(token)
        
        if not file_record:
            raise HTTPException(status_code=404, detail="File not found or already destroyed")
        
        # Check if 2FA is required
        if not file_record.get('require_otp'):
            raise HTTPException(status_code=400, detail="This file does not require 2FA")
        
        # Get OTP email
        otp_email = file_record.get('otp_email')
        if not otp_email:
            raise HTTPException(status_code=500, detail="2FA email not configured")
        
        # Generate and send OTP
        otp_srv = otp_service.get_otp_service()
        otp_code = otp_srv.create_otp_session(token, otp_email)
        
        success, error_msg = otp_srv.send_otp_email(
            email=otp_email,
            otp_code=otp_code,
            filename=file_record['filename']
        )
        
        if not success:
            raise HTTPException(status_code=500, detail=error_msg)
        
        # Mask email for privacy (show only first 2 chars and domain)
        email_parts = otp_email.split('@')
        masked_email = f"{email_parts[0][:2]}***@{email_parts[1]}" if len(email_parts) == 2 else "***"
        
        return {
            "success": True,
            "message": f"OTP sent to {masked_email}",
            "expires_in_minutes": otp_service.OTP_EXPIRY_MINUTES,
            "max_attempts": otp_service.MAX_OTP_ATTEMPTS
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"❌ OTP request failed: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to send OTP: {str(e)}")


@app.post("/verify-otp/{token}")
async def verify_otp(token: str, req: Request, otp_code: str = Form(...)):
    """Verify OTP code for 2FA-protected files"""
    try:
        # Rate limit
        security.check_rate_limit(req, limit=10)
        
        # Get file record
        file_record = await database.db.get_file_record(token)
        
        if not file_record:
            raise HTTPException(status_code=404, detail="File not found or already destroyed")
        
        # Check if 2FA is required
        if not file_record.get('require_otp'):
            raise HTTPException(status_code=400, detail="This file does not require 2FA")
        
        # Verify OTP
        otp_srv = otp_service.get_otp_service()
        is_valid, error_msg = otp_srv.verify_otp(token, otp_code)
        
        if not is_valid:
            raise HTTPException(status_code=403, detail=error_msg)
        
        return {
            "success": True,
            "message": "OTP verified successfully. You can now access the file."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"❌ OTP verification failed: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"OTP verification failed: {str(e)}")


@app.post("/share/{token}")
async def share_file(token: str, req: Request, request: DecryptRequest):
    """Server-side access endpoint - properly enforces view limits and 2FA"""
    password = request.password or ""
    try:
        # Get file record from database
        file_record = await database.db.get_file_record(token)
        
        if not file_record:
            raise HTTPException(status_code=404, detail="File not found or already destroyed")
        
        # Check if 2FA is required
        if file_record.get('require_otp'):
            otp_srv = otp_service.get_otp_service()
            if not otp_srv.is_verified(token):
                raise HTTPException(
                    status_code=403, 
                    detail="2FA verification required. Please request and verify OTP first."
                )
        
        # Get file path and check if it exists
        bar_file = file_record['file_path']
        if not os.path.exists(bar_file):
            # File was deleted but record exists - clean up
            await database.db.mark_as_destroyed(token)
            raise HTTPException(status_code=404, detail="File not found or already destroyed")
        
        # Read and unpack BAR file
        with open(bar_file, "rb") as f:
            bar_data = f.read()
        
        encrypted_data, metadata, key = crypto_utils.unpack_bar_file(bar_data)
        
        # Get current view count from database
        current_views = file_record['current_views']
        max_views = file_record['max_views']
        
        print(f"\n=== SHARE ACCESS REQUEST ===")
        print(f"Token: {token}")
        print(f"Password provided: {bool(password and password.strip())}")
        print(f"Password protected: {metadata.get('password_protected')}")
        print(f"View only: {metadata.get('view_only')}")
        print(f"Current views (DB): {current_views}/{max_views}")
        
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
        
        # Check if file has already reached max views (database is source of truth)
        if current_views >= max_views:
            raise HTTPException(status_code=403, detail=f"Maximum views reached ({current_views}/{max_views})")
        
        # Check expiry from database record
        if file_record.get('expires_at'):
            from datetime import datetime
            expires_at_str = file_record['expires_at']
            if expires_at_str:
                # Handle both SQLite (string) and PostgreSQL (datetime)
                if isinstance(expires_at_str, str):
                    if expires_at_str.endswith('Z'):
                        expires_at_str = expires_at_str[:-1]
                    expires_at = datetime.fromisoformat(expires_at_str)
                else:
                    expires_at = expires_at_str
                
                if datetime.utcnow() > expires_at:
                    raise HTTPException(status_code=403, detail="File has expired")
        
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
        
        # Log access for analytics
        ip_address = analytics.get_client_ip(req)
        user_agent = req.headers.get("User-Agent", "Unknown")
        device_type = analytics.get_device_type(user_agent)
        
        # Get geolocation (async, non-blocking)
        geo_data = await analytics.get_geolocation(ip_address)
        country = geo_data.get("country") if geo_data else None
        city = geo_data.get("city") if geo_data else None
        
        # Log the access
        await database.db.log_access(
            token=token,
            ip_address=ip_address,
            user_agent=user_agent,
            country=country,
            city=city,
            device_type=device_type
        )
        
        # Update view count in database
        success, views_remaining, should_destroy = await database.db.increment_view_count(token)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update view count")
        
        print(f"✓ View count updated in database - {views_remaining} views remaining")
        
        # Destroy the file if view limit reached
        if should_destroy:
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


@app.get("/analytics/{token}")
async def get_analytics(token: str):
    """Get analytics data for a server-side file"""
    try:
        analytics_data = await database.db.get_analytics(token)
        
        if not analytics_data:
            raise HTTPException(status_code=404, detail="File not found or no analytics data available")
        
        return analytics_data
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve analytics: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
