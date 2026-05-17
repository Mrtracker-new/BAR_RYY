"""Pydantic models for request/response validation."""
import re
from typing import Optional, List
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
    otp_emails: Optional[List[str]] = None  # Authorised recipient emails for OTP delivery (max 10)
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

    @field_validator('otp_emails', mode='after')
    @classmethod
    def validate_otp_emails(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        """Validate each email in the list.

        Rules:
        * Each entry must match a basic email-address pattern.
        * Duplicates are removed (case-insensitive dedup keeps first occurrence).
        * The list is capped at 10 addresses.
        """
        if not v:
            return v

        _MAX_OTP_EMAILS = 10
        email_pattern = re.compile(
            r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        )

        # Deduplicate (case-insensitive), preserving first-seen order.
        seen: set[str] = set()
        deduped: List[str] = []
        for email in v:
            key = email.strip().lower()
            if key not in seen:
                seen.add(key)
                deduped.append(email.strip())

        if len(deduped) > _MAX_OTP_EMAILS:
            raise ValueError(
                f'Too many OTP recipient emails — maximum is {_MAX_OTP_EMAILS}.'
            )

        for email in deduped:
            if not email_pattern.match(email):
                raise ValueError(f'Invalid email address: {email!r}')

        return deduped

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
        """Enforce that otp_emails is non-empty whenever require_otp is True.

        This check is intentionally placed in a model_validator (runs after
        all field_validators have succeeded) so it has guaranteed, reliable
        access to both require_otp and otp_emails — unlike the old @validator
        approach where a field could be missing from the ``values`` dict if
        an earlier validator on that field had failed.
        """
        if self.require_otp and not self.otp_emails:
            raise ValueError(
                'At least one recipient email address is required when 2FA is enabled'
            )
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


class OTPEmailRequest(BaseModel):
    """Request body sent by the receiver to /request-otp/{token}.

    The receiver supplies their own email address; the backend checks it
    against the stored allow-list before generating and sending an OTP.
    An opaque 403 is returned for unlisted addresses so no information about
    valid recipient addresses is leaked to an attacker.
    """
    email: str

    @field_validator('email', mode='after')
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip()
        pattern = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
        if not pattern.match(v):
            raise ValueError('Invalid email address')
        return v


# ---------------------------------------------------------------------------
# Burn Chat schemas
# ---------------------------------------------------------------------------

class ChatCreateRequest(BaseModel):
    """Request model for creating an ephemeral Burn Chat session.

    ``ttl_seconds`` is the total lifetime of the session.  When it expires
    every message is purged from server RAM and all connected clients receive
    a ``{"type": "destroyed"}`` WebSocket event.

    Limits
    ------
    * Minimum TTL: 30 seconds.
    * Maximum TTL: 72 hours (259 200 seconds).
    """

    ttl_seconds: int = Field(
        ...,
        description="Session lifetime in seconds (30 – 259200).",
        ge=30,
        le=259_200,
    )

    @field_validator('ttl_seconds', mode='after')
    @classmethod
    def validate_ttl(cls, v: int) -> int:
        if not (30 <= v <= 259_200):
            raise ValueError(
                'ttl_seconds must be between 30 (30 s) and 259200 (72 h)'
            )
        return v
