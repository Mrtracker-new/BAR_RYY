"""Pydantic models for request/response validation."""
import re
from typing import Optional
from pydantic import BaseModel, validator
from core import security


class SealRequest(BaseModel):
    """Request model for sealing a file into a BAR container."""
    filename: str
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
