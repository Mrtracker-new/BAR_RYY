"""Pydantic models for request/response validation."""
import re
from typing import Optional
from pydantic import BaseModel, Field, field_validator, model_validator
from core import security

# Format produced by save_uploaded_file: "<uuid4>__<safe_filename>"
_TEMP_FILENAME_RE = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'
    r'__[^/\\\x00]{1,200}$',
    re.IGNORECASE,
)

# Allowlist for storage_mode — defined at module level so it is constructed
# once at import time, not on every validation call.
_VALID_STORAGE_MODES: frozenset[str] = frozenset({'client', 'server'})


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

    @field_validator('storage_mode', mode='after')
    @classmethod
    def validate_storage_mode(cls, v: str) -> str:
        """Enforce that storage_mode is exactly 'client' or 'server'.

        Strict allowlist — no case-folding or whitespace normalisation.
        The value must arrive as the exact string literal; any other form
        is rejected here, before it propagates to the seal route or the
        encryption service.

        Rejects (non-exhaustive):
            'CLIENT', ' client', 'cloud', '', etc.
        """
        if v not in _VALID_STORAGE_MODES:
            raise ValueError(
                f"storage_mode must be 'client' or 'server', got {v!r}"
            )
        return v

    @field_validator('temp_filename', mode='after')
    @classmethod
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

    @field_validator('max_views', mode='after')
    @classmethod
    def validate_max_views(cls, v: int) -> int:
        if v < 1 or v > 100:
            raise ValueError('Max views must be between 1 and 100')
        return v

    @field_validator('expiry_minutes', mode='after')
    @classmethod
    def validate_expiry(cls, v: int) -> int:
        if v < 0 or v > 43200:  # Max 30 days
            raise ValueError('Expiry must be between 0 and 43200 minutes (30 days)')
        return v

    @field_validator('password', mode='after')
    @classmethod
    def validate_password(cls, v: Optional[str]) -> Optional[str]:
        # Optional password, skip validation if empty or None
        if v:
            is_valid, error = security.validate_password_strength(v)
            if not is_valid:
                raise ValueError(error)
        return v

    @field_validator('webhook_url', mode='after')
    @classmethod
    def validate_webhook(cls, v: Optional[str]) -> Optional[str]:
        if v and not security.validate_webhook_url(v):
            raise ValueError('Invalid webhook URL')
        return v

    @field_validator('otp_email', mode='after')
    @classmethod
    def validate_otp_email(cls, v: Optional[str]) -> Optional[str]:
        # Basic email format validation (presence check is handled by the
        # model_validator below, which has guaranteed access to all fields).
        if v:
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(email_pattern, v):
                raise ValueError('Invalid email address')
        return v

    @field_validator('view_refresh_minutes', mode='after')
    @classmethod
    def validate_view_refresh_minutes(cls, v: int) -> int:
        if v < 0 or v > 1440:  # Max 24 hours
            raise ValueError('View refresh minutes must be between 0 and 1440 (24 hours)')
        return v

    @field_validator('auto_refresh_seconds', mode='after')
    @classmethod
    def validate_auto_refresh_seconds(cls, v: int) -> int:
        if v < 0 or v > 300:  # Max 5 minutes
            raise ValueError('Auto refresh seconds must be between 0 and 300 (5 minutes)')
        return v

    @model_validator(mode='after')
    def validate_otp_consistency(self) -> 'SealRequest':
        """Enforce that otp_email is present whenever require_otp is True.

        This check is intentionally placed in a model_validator (runs after
        all field_validators have succeeded) so it has guaranteed, reliable
        access to both require_otp and otp_email — unlike the old @validator
        approach where a field could be missing from the ``values`` dict if
        an earlier validator on that field had failed.
        """
        if self.require_otp and not self.otp_email:
            raise ValueError('Email address required when 2FA is enabled')
        return self


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
