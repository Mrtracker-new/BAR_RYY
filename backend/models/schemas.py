"""Pydantic models for request/response validation."""
import re
from typing import Optional
from pydantic import BaseModel, Field, validator
from core import security

# Format produced by save_uploaded_file: "<uuid4>__<safe_filename>"
_TEMP_FILENAME_RE = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'
    r'__[^/\\\x00]{1,200}$',
    re.IGNORECASE,
)


class SealRequest(BaseModel):
    """Request model for sealing a file into a BAR container.

    Security note: callers must supply ``temp_filename`` — the opaque
    ``<uuid>__<safe_filename>`` token returned by the /upload endpoint.
    The server resolves it to an exact filesystem path; no directory
    scan or user-controlled filename matching is performed.
    """
    # The full UUID-prefixed temp name from /upload (e.g. "abc...__report.pdf").
    # The original display name is derived server-side from this token.
    temp_filename: str
    max_views: int = 1
    expiry_minutes: int = 0
    password: Optional[str] = None
    webhook_url: Optional[str] = None
    view_only: bool = False
    storage_mode: str = 'client'  # 'client' or 'server'
    require_otp: bool = False  # Enable 2FA
    otp_email: Optional[str] = None  # Email for OTP delivery
    view_refresh_minutes: int = 0  # Time threshold for view refresh control (0 = disabled)
    auto_refresh_seconds: int = 0  # Auto-refresh interval in seconds (0 = disabled)

    @validator('temp_filename')
    def validate_temp_filename(cls, v: str) -> str:
        """Enforce that the token matches the exact format produced by /upload.

        Format: <UUID4>__<safe_filename>
        Rejects path traversal sequences, null bytes, and any value that
        does not carry a valid UUID4 prefix.
        """
        if not v:
            raise ValueError('temp_filename is required')
        if not _TEMP_FILENAME_RE.match(v):
            raise ValueError(
                'Invalid temp_filename: must be the token returned by /upload'
            )
        # Derive the original safe filename (the part after the first "__")
        safe_name = v.split('__', 1)[1]
        if not security.validate_file_extension(safe_name):
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
            # Use security module's password strength validation (8 chars + complexity)
            is_valid, error = security.validate_password_strength(v)
            if not is_valid:
                raise ValueError(error)
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
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(email_pattern, v):
                raise ValueError('Invalid email address')
        return v
    
    @validator('view_refresh_minutes')
    def validate_view_refresh_minutes(cls, v):
        if v < 0 or v > 1440:  # Max 24 hours
            raise ValueError('View refresh minutes must be between 0 and 1440 (24 hours)')
        return v
    
    @validator('auto_refresh_seconds')
    def validate_auto_refresh_seconds(cls, v):
        if v < 0 or v > 300:  # Max 5 minutes
            raise ValueError('Auto refresh seconds must be between 0 and 300 (5 minutes)')
        return v


class DecryptRequest(BaseModel):
    """Request model for decrypting a BAR file."""
    password: Optional[str] = None


class OTPRequest(BaseModel):
    """Request model for OTP operations."""
    token: str


class OTPVerifyRequest(BaseModel):
    """Request model for OTP verification."""
    token: str
    otp_code: str
    password: Optional[str] = None
