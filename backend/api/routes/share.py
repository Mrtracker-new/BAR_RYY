"""Share endpoints for server-side files with 2FA support."""
import os
import json
import asyncio
import logging
import mimetypes
from datetime import datetime
from fastapi import APIRouter, Request, Form, Depends, HTTPException, Header
from fastapi.responses import Response

from models.schemas import DecryptRequest
from core import security
from services.encryption_service import EncryptionService
from api.dependencies import get_encryption_service_dep, get_otp_service_dep, get_database
from utils import crypto_utils
from core import database
from services import analytics
from services import webhook_service

logger = logging.getLogger(__name__)

router = APIRouter()


# /check-2fa/{token} was intentionally removed.
# It acted as a token-existence oracle: 404 vs 200 let an attacker enumerate
# valid tokens without any authentication or rate limit cost.  The frontend
# now always renders the full access form (password + OTP accordion) and
# discovers security requirements at /share/{token} time instead.


@router.post("/request-otp/{token}")
async def request_otp(
    token: str,
    req: Request,
    db=Depends(get_database),
    otp_service=Depends(get_otp_service_dep)
):
    """Request OTP code to be sent via email for 2FA-protected files."""
    try:
        # ── Rate limiting ───────────────────────────────────────────────────
        # Layer 1: global per-IP limit (5 req/min across all tokens)
        security.check_rate_limit(req, limit=5)

        # Layer 2: per-token per-IP limit — prevents an attacker who knows a
        # valid token from spamming the owner's inbox even after rotating IPs.
        # We reuse the password brute-force storage with a dedicated namespace
        # prefix so the OTP counter is tracked independently.
        client_ip = analytics.get_client_ip(req)
        otp_key = f"otp:{token}:{client_ip}"
        security.check_rate_limit_keyed(otp_key, limit=3, window_seconds=300)
        
        # Get file record
        file_record = await db.get_file_record(token)
        
        # ── Oracle-free token validation ───────────────────────────────────
        # Both the "token does not exist" and "token exists but has no OTP"
        # branches return the same opaque 403 so an attacker cannot use this
        # endpoint to distinguish live tokens from dead ones.
        if not file_record or not file_record.get('require_otp'):
            raise HTTPException(status_code=403, detail="Access denied.")
        
        # Get OTP email
        otp_email = file_record.get('otp_email')
        if not otp_email:
            raise HTTPException(status_code=500, detail="2FA email not configured")
        
        # Generate and send OTP
        otp_code = otp_service.create_otp_session(token, otp_email)
        
        success, error_msg = await otp_service.send_otp_email(
            email=otp_email,
            otp_code=otp_code,
            filename=file_record['filename']
        )
        
        if not success:
            logger.error('OTP send failed for token %s: %s', token, error_msg)
            raise HTTPException(status_code=500, detail=security.OPAQUE_500_DETAIL)
        
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
    except Exception:
        logger.exception("Unhandled error in request_otp [token=%s]", token)
        raise HTTPException(status_code=500, detail=security.OPAQUE_500_DETAIL)



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
        
        # ── Oracle-free token validation ───────────────────────────────────
        # Same pattern as request_otp: collapse "token not found" and
        # "token has no OTP" into one indistinguishable 403.
        if not file_record or not file_record.get('require_otp'):
            raise HTTPException(status_code=403, detail="Access denied.")
        
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
    except Exception:
        logger.exception("Unhandled error in verify_otp [token=%s]", token)
        raise HTTPException(status_code=500, detail=security.OPAQUE_500_DETAIL)


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
        
        # Resolve file path from DB record, then open atomically.
        # Using a single open() instead of os.path.exists() + open() eliminates
        # the file-existence TOCTOU race: if a concurrent request destroys the
        # file between get_file_record() and here, FileNotFoundError is caught
        # cleanly rather than crashing with an unhandled exception.
        bar_file = file_record['file_path']
        try:
            with open(bar_file, "rb") as f:
                bar_data = f.read()
        except FileNotFoundError:
            # File was deleted by a concurrent request that hit the view limit
            # just before us.  Clean up the stale DB record and return 410.
            await db.mark_as_destroyed(token)
            raise HTTPException(
                status_code=410,
                detail="File not found or already destroyed"
            )

        password_to_use = password.strip() if password and password.strip() else None

        # ------------------------------------------------------------------ #
        # Parse DB metadata once — needed for webhook URL and password flag   #
        # before we have decrypted metadata from the BAR file.                #
        # ------------------------------------------------------------------ #
        db_metadata = file_record.get('metadata') or {}
        if isinstance(db_metadata, str):
            db_metadata = json.loads(db_metadata)
        is_password_protected = bool(db_metadata.get('password_protected'))
        client_ip = analytics.get_client_ip(req)

        # ------------------------------------------------------------------ #
        # Password gate — runs BEFORE decrypt so the brute-force lockout      #
        # fires before any expensive PBKDF2 key derivation is attempted.      #
        # ------------------------------------------------------------------ #
        if is_password_protected:
            # Step 1 — lockout / progressive-delay check
            try:
                failed_count = await security.check_and_delay_password_attempt(client_ip, token)
                if failed_count > 0:
                    logger.warning(
                        '[%s] %d previous failed attempt(s) from %s',
                        token, failed_count, client_ip,
                    )
            except HTTPException:
                raise

            # Step 2 — reject missing password early (no PBKDF2 wasted)
            if not password_to_use:
                security.record_password_attempt(client_ip, False, token)
                webhook_url = db_metadata.get("webhook_url")
                if webhook_url:
                    webhook_srv = webhook_service.get_webhook_service()
                    asyncio.create_task(webhook_srv.send_access_denied_alert(
                        webhook_url=webhook_url,
                        filename=db_metadata.get("filename", "unknown"),
                        reason="Password required but not provided",
                        ip_address=client_ip,
                    ))
                raise HTTPException(status_code=403, detail="Password required")

        # ------------------------------------------------------------------ #
        # Decrypt BAR file — password correctness validated inside via        #
        # PBKDF2 key derivation + HMAC signature check.                       #
        # ------------------------------------------------------------------ #
        try:
            decrypted_data, metadata, key, _enc, _salt = encryption_service.decrypt_bar_file(
                bar_data, password_to_use
            )
        except HTTPException as e:
            if e.status_code == 403:
                if is_password_protected:
                    # Wrong password — advance the brute-force counter
                    security.record_password_attempt(client_ip, False, token)
                webhook_url = db_metadata.get("webhook_url")
                if webhook_url:
                    webhook_srv = webhook_service.get_webhook_service()
                    asyncio.create_task(webhook_srv.send_access_denied_alert(
                        webhook_url=webhook_url,
                        filename=db_metadata.get("filename", "unknown"),
                        reason=str(e.detail),
                        ip_address=client_ip,
                    ))
            raise


        # ------------------------------------------------------------------ #
        # Successful decryption — record it                                   #
        # ------------------------------------------------------------------ #
        if is_password_protected:
            security.record_password_attempt(client_ip, True, token)

        # NOTE: we deliberately do NOT read current_views / max_views from
        # file_record here.  That snapshot was taken at the top of this
        # function and may be stale by the time we reach this point under
        # concurrent load.  Limit enforcement is handled atomically inside
        # atomic_try_increment_view_count() below.

        # Check expiry (immutable metadata — no race risk)
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
                        asyncio.create_task(webhook_srv.send_access_denied_alert(
                            webhook_url=webhook_url,
                            filename=metadata.get("filename", "unknown"),
                            reason="File has expired",
                            ip_address=client_ip
                        ))
                    
                    raise HTTPException(status_code=403, detail="File has expired")
        
        logger.info('[%s] Access validation passed', token)

        # Generate session fingerprint for view refresh control
        ip_address = analytics.get_client_ip(req)
        user_agent = req.headers.get("User-Agent", "Unknown")

        from utils.crypto_utils import generate_session_fingerprint
        session_fingerprint = generate_session_fingerprint(token, ip_address, user_agent)

        # Get view refresh setting from metadata
        view_refresh_minutes = metadata.get("view_refresh_minutes", 0)

        # Get device and geolocation for analytics
        device_type = analytics.get_device_type(user_agent)
        geo_data = await analytics.get_geolocation(ip_address)
        country = geo_data.get("country") if geo_data else None
        city = geo_data.get("city") if geo_data else None

        # ------------------------------------------------------------------ #
        # Atomic view-count increment (C-04 fix)                              #
        # The guarded UPDATE inside atomic_try_increment_view_count() is the  #
        # single source of truth for limit enforcement.  If limit_hit is True #
        # the DB rejected the increment because current_views >= max_views at  #
        # the moment of the UPDATE — no file content is served.               #
        # ------------------------------------------------------------------ #
        db_ok, views_remaining, should_destroy, is_new_view, limit_hit = \
            await db.atomic_try_increment_view_count(
                token,
                session_fingerprint=session_fingerprint,
                view_refresh_minutes=view_refresh_minutes,
            )

        if not db_ok:
            raise HTTPException(status_code=500, detail="Failed to update view count")

        if limit_hit:
            # Atomic guard fired: another concurrent request already exhausted
            # the view budget.  Return 410 Gone — the resource no longer exists.
            webhook_url = metadata.get("webhook_url")
            if webhook_url:
                webhook_srv = webhook_service.get_webhook_service()
                asyncio.create_task(webhook_srv.send_access_denied_alert(
                    webhook_url=webhook_url,
                    filename=metadata.get("filename", "unknown"),
                    reason="Maximum views reached — atomic guard rejected request",
                    ip_address=client_ip,
                ))
            raise HTTPException(
                status_code=410,
                detail="Maximum views reached — file has been destroyed"
            )

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
            logger.info('[%s] New view counted — %d views remaining', token, views_remaining)
        else:
            logger.info(
                '[%s] Within refresh threshold — view not counted (%d remaining)',
                token, views_remaining,
            )
        
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
            try:
                crypto_utils.secure_delete_file(bar_file)
                logger.info('[%s] File destroyed after reaching max views', token)
            except Exception as _del_err:
                # Log but don't abort — last viewer still gets their content.
                # DB is already marked destroyed; file is unreachable regardless.
                logger.warning(
                    '[%s] secure_delete_file error (file inaccessible via DB): %s',
                    token, _del_err,
                )

            # Send destruction webhook
            webhook_url = metadata.get("webhook_url")
            if webhook_url:
                # max_views comes from file_record (immutable metadata — safe
                # to use here; we only removed the stale *view count* snapshot).
                _max_views = file_record.get('max_views', 0)
                webhook_srv = webhook_service.get_webhook_service()
                asyncio.create_task(webhook_srv.send_destruction_alert(
                    webhook_url=webhook_url,
                    filename=metadata.get("filename", "unknown"),
                    reason="Maximum views reached",
                    views_used=_max_views,
                    max_views=_max_views
                ))

        # Return decrypted file
        view_only = metadata.get('view_only', False)
        filename = metadata['filename']

        # Determine MIME type
        if view_only:
            mime_type, _ = mimetypes.guess_type(filename)
            if not mime_type:
                mime_type = "application/octet-stream"
            content_disposition = security.build_content_disposition(filename, 'inline')
        else:
            mime_type = "application/octet-stream"
            content_disposition = security.build_content_disposition(filename, 'attachment')

        # Build security headers
        response_headers = {
            "Content-Disposition": content_disposition,
            "X-Content-Type-Options": "nosniff",  # Prevent MIME-sniffing
            "X-BAR-Views-Remaining": str(views_remaining),
            "X-BAR-Should-Destroy": str(should_destroy).lower(),
            "X-BAR-View-Only": str(view_only).lower(),
            "X-BAR-Filename": security.sanitize_header_value(filename),
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
    except Exception:
        logger.exception("Unhandled error in share_file [token=%s]", token)
        raise HTTPException(status_code=500, detail=security.OPAQUE_500_DETAIL)



@router.get("/analytics/{token}")
async def get_analytics(
    token: str,
    db=Depends(get_database),
    analytics_key: str = Header(
        ...,
        alias="X-Analytics-Key",
        description=(
            "Secret analytics key issued at seal time. "
            "Must be transmitted as a request header — never as a query parameter — "
            "so it is not captured in server access logs, browser history, "
            "CDN/proxy logs, or Referer headers."
        ),
    ),
):
    """
    Get analytics data for a server-side file.

    Authentication
    --------------
    The caller must supply the ``X-Analytics-Key`` header whose value matches
    the key that was generated at seal time.  The key is validated with a
    constant-time comparison (``hmac.compare_digest``) inside
    ``Database.get_analytics`` to prevent timing side-channel attacks.

    Security note
    -------------
    The key is intentionally delivered via a *header* rather than a query
    parameter.  Query parameters are:
    * logged verbatim in web-server / CDN access logs
    * stored in browser history
    * forwarded in the ``Referer`` header to third-party resources

    Headers are kept out of URL-based log fields and are therefore
    substantially harder for an adversary to recover passively.
    """
    try:
        analytics_data = await db.get_analytics(token, analytics_key)
        
        if analytics_data is None:
            # Return 403 for both missing record and wrong key — don't reveal which
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        return analytics_data
        
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unhandled error in get_analytics [token=%s]", token)
        raise HTTPException(status_code=500, detail=security.OPAQUE_500_DETAIL)
