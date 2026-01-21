"""Share endpoints for server-side files with 2FA support."""
import os
import json
import hashlib
import asyncio
import traceback
import mimetypes
from datetime import datetime
from fastapi import APIRouter, Request, Form, Depends, HTTPException
from fastapi.responses import Response

from models.schemas import DecryptRequest
from core import security
from services.encryption_service import EncryptionService
from api.dependencies import get_encryption_service_dep, get_otp_service_dep, get_database
import crypto_utils
import database
import analytics
import webhook_service

router = APIRouter()


@router.get("/check-2fa/{token}")
async def check_2fa(token: str, db=Depends(get_database)):
    """Check if a file requires 2FA."""
    try:
        file_record = await db.get_file_record(token)
        
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


@router.post("/request-otp/{token}")
async def request_otp(
    token: str,
    req: Request,
    db=Depends(get_database),
    otp_service=Depends(get_otp_service_dep)
):
    """Request OTP code to be sent via email for 2FA-protected files."""
    try:
        # Rate limit
        security.check_rate_limit(req, limit=5)
        
        # Get file record
        file_record = await db.get_file_record(token)
        
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
        otp_code = otp_service.create_otp_session(token, otp_email)
        
        success, error_msg = otp_service.send_otp_email(
            email=otp_email,
            otp_code=otp_code,
            filename=file_record['filename']
        )
        
        if not success:
            raise HTTPException(status_code=500, detail=error_msg)
        
        # Mask email for privacy
        email_parts = otp_email.split('@')
        masked_email = f"{email_parts[0][:2]}***@{email_parts[1]}" if len(email_parts) == 2 else "***"
        
        from services.otp_service import OTP_EXPIRY_MINUTES, MAX_OTP_ATTEMPTS
        
        return {
            "success": True,
            "message": f"OTP sent to {masked_email}",
            "expires_in_minutes": OTP_EXPIRY_MINUTES,
            "max_attempts": MAX_OTP_ATTEMPTS
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ OTP request failed: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to send OTP: {str(e)}")


@router.post("/verify-otp/{token}")
async def verify_otp(
    token: str,
    req: Request,
    otp_code: str = Form(...),
    db=Depends(get_database),
    otp_service=Depends(get_otp_service_dep)
):
    """Verify OTP code for 2FA-protected files."""
    try:
        # Rate limit
        security.check_rate_limit(req, limit=10)
        
        # Get file record
        file_record = await db.get_file_record(token)
        
        if not file_record:
            raise HTTPException(status_code=404, detail="File not found or already destroyed")
        
        # Check if 2FA is required
        if not file_record.get('require_otp'):
            raise HTTPException(status_code=400, detail="This file does not require 2FA")
        
        # Verify OTP
        is_valid, error_msg = otp_service.verify_otp(token, otp_code)
        
        if not is_valid:
            raise HTTPException(status_code=403, detail=error_msg)
        
        return {
            "success": True,
            "message": "OTP verified successfully. You can now access the file."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ OTP verification failed: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"OTP verification failed: {str(e)}")


@router.post("/share/{token}")
async def share_file(
    token: str,
    req: Request,
    request: DecryptRequest,
    db=Depends(get_database),
    encryption_service: EncryptionService = Depends(get_encryption_service_dep),
    otp_service=Depends(get_otp_service_dep)
):
    """Server-side access endpoint - properly enforces view limits and 2FA."""
    password = request.password or ""
    try:
        # Get file record from database
        file_record = await db.get_file_record(token)
        
        if not file_record:
            raise HTTPException(status_code=404, detail="File not found or already destroyed")
        
        # Check if 2FA is required
        if file_record.get('require_otp'):
            if not otp_service.is_verified(token):
                raise HTTPException(
                    status_code=403,
                    detail="2FA verification required. Please request and verify OTP first."
                )
        
        # Get file path and check if it exists
        bar_file = file_record['file_path']
        if not os.path.exists(bar_file):
            # File was deleted but record exists - clean up
            await db.mark_as_destroyed(token)
            raise HTTPException(status_code=404, detail="File not found or already destroyed")
        
        # Read and decrypt BAR file
        with open(bar_file, "rb") as f:
            bar_data = f.read()
        
        password_to_use = password.strip() if password and password.strip() else None
        
        try:
            decrypted_data, metadata, key = encryption_service.decrypt_bar_file(bar_data, password_to_use)
        except HTTPException as e:
            # Send access denied webhook
            if e.status_code == 403 and file_record.get('metadata'):
                metadata_from_db = file_record['metadata']
                if isinstance(metadata_from_db, str):
                    metadata_from_db = json.loads(metadata_from_db)
                webhook_url = metadata_from_db.get("webhook_url")
                if webhook_url:
                    client_ip = analytics.get_client_ip(req)
                    webhook_srv = webhook_service.get_webhook_service()
                    asyncio.create_task(webhook_srv.send_access_denied_alert(
                        webhook_url=webhook_url,
                        filename=metadata_from_db.get("filename", "unknown"),
                        reason=str(e.detail),
                        ip_address=client_ip
                    ))
            raise
        
        # Get current view count from database
        current_views = file_record['current_views']
        max_views = file_record['max_views']
        
        print(f"\n=== SHARE ACCESS REQUEST ===")
        print(f"Token: {token}")
        print(f"Password provided: {bool(password and password.strip())}")
        print(f"Password protected: {metadata.get('password_protected')}")
        print(f"Current views (DB): {current_views}/{max_views}")
        
        # Validate password if protected
        if metadata.get("password_protected"):
            client_ip = analytics.get_client_ip(req)
            
            # Check brute force protection
            try:
                failed_count = security.check_and_delay_password_attempt(client_ip, token)
                if failed_count > 0:
                    print(f"⚠️ Previous failed attempts: {failed_count}")
            except HTTPException:
                raise
            
            if not password or not password.strip():
                security.record_password_attempt(client_ip, False, token)
                
                # Send access denied webhook
                webhook_url = metadata.get("webhook_url")
                if webhook_url:
                    webhook_srv = webhook_service.get_webhook_service()
                    asyncio.create_task(webhook_srv.send_access_denied_alert(
                        webhook_url=webhook_url,
                        filename=metadata.get("filename", "unknown"),
                        reason="Password required but not provided",
                        ip_address=client_ip
                    ))
                
                raise HTTPException(status_code=403, detail="Password required")
            
            # Validate password hash
            stored_hash = metadata.get("password_hash")
            if stored_hash:
                provided_hash = hashlib.sha256(password.strip().encode()).hexdigest()
                
                if provided_hash != stored_hash:
                    security.record_password_attempt(client_ip, False, token)
                    
                    # Send access denied webhook
                    webhook_url = metadata.get("webhook_url")
                    if webhook_url:
                        webhook_srv = webhook_service.get_webhook_service()
                        asyncio.create_task(webhook_srv.send_access_denied_alert(
                            webhook_url=webhook_url,
                            filename=metadata.get("filename", "unknown"),
                            reason="Invalid password",
                            ip_address=client_ip
                        ))
                    
                    raise HTTPException(status_code=403, detail="Invalid password")
                
                security.record_password_attempt(client_ip, True, token)
        
        # Check view limits
        if current_views >= max_views:
            webhook_url = metadata.get("webhook_url")
            if webhook_url:
                webhook_srv = webhook_service.get_webhook_service()
                client_ip = analytics.get_client_ip(req)
                asyncio.create_task(webhook_srv.send_access_denied_alert(
                    webhook_url=webhook_url,
                    filename=metadata.get("filename", "unknown"),
                    reason=f"Maximum views reached ({current_views}/{max_views})",
                    ip_address=client_ip
                ))
            
            raise HTTPException(status_code=403, detail=f"Maximum views reached ({current_views}/{max_views})")
        
        # Check expiry
        if file_record.get('expires_at'):
            expires_at_str = file_record['expires_at']
            if expires_at_str:
                if isinstance(expires_at_str, str):
                    if expires_at_str.endswith('Z'):
                        expires_at_str = expires_at_str[:-1]
                    expires_at = datetime.fromisoformat(expires_at_str)
                else:
                    expires_at = expires_at_str
                
                if datetime.utcnow() > expires_at:
                    webhook_url = metadata.get("webhook_url")
                    if webhook_url:
                        webhook_srv = webhook_service.get_webhook_service()
                        client_ip = analytics.get_client_ip(req)
                        asyncio.create_task(webhook_srv.send_access_denied_alert(
                            webhook_url=webhook_url,
                            filename=metadata.get("filename", "unknown"),
                            reason="File has expired",
                            ip_address=client_ip
                        ))
                    
                    raise HTTPException(status_code=403, detail="File has expired")
        
        print("✅ Access validation passed")
        
        # Generate session fingerprint for view refresh control
        ip_address = analytics.get_client_ip(req)
        user_agent = req.headers.get("User-Agent", "Unknown")
        
        from crypto_utils import generate_session_fingerprint
        session_fingerprint = generate_session_fingerprint(token, ip_address, user_agent)
        
        # Get view refresh setting from metadata
        view_refresh_minutes = metadata.get("view_refresh_minutes", 0)
        
        # Get device and geolocation for analytics
        device_type = analytics.get_device_type(user_agent)
        geo_data = await analytics.get_geolocation(ip_address)
        country = geo_data.get("country") if geo_data else None
        city = geo_data.get("city") if geo_data else None
        
        # Update view count in database (with fingerprint check)
        success, views_remaining, should_destroy, is_new_view = await db.increment_view_count(
            token,
            session_fingerprint=session_fingerprint,
            view_refresh_minutes=view_refresh_minutes
        )
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update view count")
        
        # Log the access (always log, even if not counted as new view)
        await db.log_access(
            token=token,
            ip_address=ip_address,
            user_agent=user_agent,
            country=country,
            city=city,
            device_type=device_type,
            session_fingerprint=session_fingerprint,
            is_counted_as_view=is_new_view
        )
        
        if is_new_view:
            print(f"✓ New view counted - {views_remaining} views remaining")
        else:
            print(f"⏱️ Within refresh threshold - view not counted ({views_remaining} remaining)")
        
        # Clear OTP verification
        if file_record.get('require_otp'):
            otp_service.clear_verification(token)
        
        # Send successful access webhook
        webhook_url = metadata.get("webhook_url")
        if webhook_url:
            webhook_srv = webhook_service.get_webhook_service()
            asyncio.create_task(webhook_srv.send_access_alert(
                webhook_url=webhook_url,
                filename=metadata.get("filename", "unknown"),
                ip_address=ip_address,
                views_remaining=views_remaining
            ))
        
        # Destroy file if view limit reached
        if should_destroy:
            crypto_utils.secure_delete_file(bar_file)
            print(f"🔥 File destroyed after reaching max views")
            
            # Send destruction webhook
            webhook_url = metadata.get("webhook_url")
            if webhook_url:
                webhook_srv = webhook_service.get_webhook_service()
                asyncio.create_task(webhook_srv.send_destruction_alert(
                    webhook_url=webhook_url,
                    filename=metadata.get("filename", "unknown"),
                    reason="Maximum views reached",
                    views_used=max_views,
                    max_views=max_views
                ))
        
        # Return decrypted file
        view_only = metadata.get('view_only', False)
        filename = metadata['filename']
        
        # Determine MIME type
        if view_only:
            mime_type, _ = mimetypes.guess_type(filename)
            if not mime_type:
                mime_type = "application/octet-stream"
            content_disposition = f"inline; filename={filename}"
        else:
            mime_type = "application/octet-stream"
            content_disposition = f"attachment; filename={filename}"
        
        # Build security headers
        response_headers = {
            "Content-Disposition": content_disposition,
            "X-Content-Type-Options": "nosniff",  # Prevent MIME-sniffing
            "X-BAR-Views-Remaining": str(views_remaining),
            "X-BAR-Should-Destroy": str(should_destroy).lower(),
            "X-BAR-View-Only": str(view_only).lower(),
            "X-BAR-Filename": filename,
            "X-BAR-Storage-Mode": "server",
            "X-BAR-Is-New-View": str(is_new_view).lower(),
            "X-BAR-Auto-Refresh-Seconds": str(metadata.get("auto_refresh_seconds", 0))
        }
        
        # Add CSP sandbox for inline content to prevent XSS attacks
        if view_only:
            response_headers["Content-Security-Policy"] = "sandbox; default-src 'none';"
        
        return Response(
            content=decrypted_data,
            media_type=mime_type,
            headers=response_headers
        )
        
    except HTTPException:
        raise
    except Exception as e:
        error_detail = f"Access failed: {str(e)}\n{traceback.format_exc()}"
        print(error_detail)
        raise HTTPException(status_code=500, detail=f"Access failed: {str(e)}")


@router.get("/analytics/{token}")
async def get_analytics(token: str, db=Depends(get_database)):
    """Get analytics data for a server-side file."""
    try:
        analytics_data = await db.get_analytics(token)
        
        if not analytics_data:
            raise HTTPException(status_code=404, detail="File not found or no analytics data available")
        
        return analytics_data
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve analytics: {str(e)}")
