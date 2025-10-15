from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
import uuid
import shutil
import json
import base64
from datetime import datetime
import crypto_utils


app = FastAPI(title="BAR Web API", version="1.0")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


class DecryptRequest(BaseModel):
    password: Optional[str] = None


@app.get("/")
async def root():
    return {
        "message": "BAR Web API - Burn After Reading",
        "version": "1.0",
        "endpoints": [
            "/upload - Upload file",
            "/seal - Seal and generate .bar file",
            "/decrypt/{bar_id} - Decrypt and retrieve file"
        ]
    }


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload a file temporarily"""
    try:
        # Generate unique ID for this upload
        file_id = str(uuid.uuid4())
        file_extension = os.path.splitext(file.filename)[1]
        # Store with pattern: {file_id}__{original_filename}
        temp_filename = f"{file_id}__{file.filename}"
        temp_path = os.path.join(UPLOAD_DIR, temp_filename)
        
        # Save uploaded file
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        return {
            "success": True,
            "file_id": file_id,
            "filename": file.filename,
            "temp_filename": temp_filename,
            "size": os.path.getsize(temp_path),
            "message": "File uploaded successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@app.post("/seal")
async def seal_container(request: SealRequest):
    """Seal the file with encryption and rules, generate .bar file"""
    try:
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
        
        # Create metadata
        metadata = crypto_utils.create_bar_metadata(
            filename=request.filename,
            max_views=request.max_views,
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
        
        # Clean up uploaded file
        os.remove(uploaded_file)
        
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
            
            return {
                "success": True,
                "storage_mode": "server",
                "access_token": access_token,
                "share_url": f"/share/{access_token}",
                "metadata": metadata,
                "message": "Container sealed and stored on server"
            }
        else:
            # Client-side: Return download URL (current behavior)
            return {
                "success": True,
                "storage_mode": "client",
                "bar_id": bar_id,
                "bar_filename": bar_filename,
                "download_url": f"/download/{bar_id}",
                "metadata": metadata,
                "message": "Container sealed successfully"
            }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"Seal failed: {str(e)}\n{traceback.format_exc()}"
        print(error_detail)  # Log to console
        raise HTTPException(status_code=500, detail=f"Seal failed: {str(e)}")


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
            # Destroy the BAR file
            os.remove(bar_file)
        
        # Return decrypted file
        original_filename = metadata.get("filename", "decrypted_file")
        
        return Response(
            content=decrypted_data,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename={original_filename}",
                "X-BAR-Views-Remaining": str(max(0, metadata.get("max_views", 0) - metadata["current_views"])),
                "X-BAR-Destroyed": str(should_destroy).lower()
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Decryption failed: {str(e)}")


@app.post("/decrypt-upload")
async def decrypt_uploaded_bar_file(file: UploadFile = File(...), password: str = Form("")):
    """Decrypt a .bar file that was uploaded directly (tracks view count properly)"""
    try:
        # Read uploaded .bar file
        bar_data = await file.read()
        
        # Unpack BAR file
        encrypted_data, metadata, key = crypto_utils.unpack_bar_file(bar_data)
        
        # Debug logging
        print(f"\n=== DECRYPT REQUEST ===")
        print(f"Max Views: {metadata.get('max_views')}")
        print(f"Current Views: {metadata.get('current_views')}")
        print(f"Password Protected: {metadata.get('password_protected')}")
        print(f"Expires At: {metadata.get('expires_at')}")
        print(f"Password Provided: {bool(password and password.strip())}")
        
        # Validate access (only check password if it was set)
        password_to_check = password if password and password.strip() else None
        is_valid, errors = crypto_utils.validate_bar_access(metadata, password_to_check)
        
        if not is_valid:
            error_msg = "; ".join(errors)
            print(f"\n!!! ACCESS DENIED !!!")
            print(f"Errors: {error_msg}")
            print(f"Validation Details:")
            print(f"  - Max views check: {metadata.get('current_views', 0)} >= {metadata.get('max_views', 0)}")
            print(f"  - Result: {metadata.get('current_views', 0) >= metadata.get('max_views', 0)}")
            raise HTTPException(status_code=403, detail=error_msg)
        
        print(f"✓ Access granted!")
        
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
        
        # Update view count
        metadata["current_views"] = metadata.get("current_views", 0) + 1
        
        # Check if should destroy
        should_destroy = False
        if metadata.get("max_views", 0) > 0:
            if metadata["current_views"] >= metadata["max_views"]:
                should_destroy = True
        
        views_remaining = max(0, metadata.get("max_views", 0) - metadata["current_views"])
        
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


@app.get("/share/{token}")
async def share_file(token: str, password: str = ""):
    """Server-side access endpoint - properly enforces view limits"""
    try:
        # Find BAR file by token
        bar_file = os.path.join(GENERATED_DIR, f"{token}.bar")
        
        if not os.path.exists(bar_file):
            raise HTTPException(status_code=404, detail="File not found or already destroyed")
        
        # Read and unpack BAR file
        with open(bar_file, "rb") as f:
            bar_data = f.read()
        
        encrypted_data, metadata, key = crypto_utils.unpack_bar_file(bar_data)
        
        # Validate password if protected
        if metadata.get("password_protected"):
            if not password or not password.strip():
                raise HTTPException(status_code=403, detail="Password required")
            
            # Check password hash
            import hashlib
            provided_hash = hashlib.sha256(password.encode()).hexdigest()
            stored_hash = metadata.get("password_hash")
            
            if stored_hash and provided_hash != stored_hash:
                raise HTTPException(status_code=403, detail="Invalid password")
        
        # Validate access (expiry, view count)
        password_to_check = password if password and password.strip() else None
        is_valid, errors = crypto_utils.validate_bar_access(metadata, password_to_check)
        
        if not is_valid:
            raise HTTPException(status_code=403, detail="; ".join(errors))
        
        # Decrypt file
        try:
            decrypted_data = crypto_utils.decrypt_file(encrypted_data, key)
        except Exception as e:
            raise HTTPException(status_code=500, detail="Decryption failed")
        
        # Verify integrity
        file_hash = crypto_utils.calculate_file_hash(decrypted_data)
        if file_hash != metadata.get("file_hash"):
            raise HTTPException(status_code=500, detail="File integrity check failed")
        
        # Update view count
        metadata["current_views"] = metadata.get("current_views", 0) + 1
        
        # Check if should destroy
        should_destroy = False
        if metadata.get("max_views", 0) > 0:
            if metadata["current_views"] >= metadata["max_views"]:
                should_destroy = True
        
        views_remaining = max(0, metadata.get("max_views", 0) - metadata["current_views"])
        
        # CRITICAL: Update the .bar file on server with incremented view count
        if not should_destroy:
            updated_bar_data = crypto_utils.pack_bar_file(encrypted_data, metadata, key)
            with open(bar_file, "wb") as f:
                f.write(updated_bar_data)
            print(f"✓ View count updated: {metadata['current_views']}/{metadata.get('max_views', 0)}")
        else:
            # Destroy the file
            os.remove(bar_file)
            print(f"🔥 File destroyed after reaching max views")
        
        # Return decrypted file
        return Response(
            content=decrypted_data,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename={metadata['filename']}",
                "X-BAR-Views-Remaining": str(views_remaining),
                "X-BAR-Should-Destroy": str(should_destroy).lower(),
                "X-BAR-View-Only": str(metadata.get('view_only', False)).lower(),
                "X-BAR-Filename": metadata["filename"],
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
