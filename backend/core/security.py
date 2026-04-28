"""
Security utilities and middleware for BAR Web API
"""
from fastapi import Request, HTTPException
from fastapi.responses import Response
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Dict
from urllib.parse import quote, urlparse
import json
import re
import os
import unicodedata
import socket
import ipaddress
import logging

logger = logging.getLogger(__name__)

# Rate limiting storage (in production, use Redis)
rate_limit_storage: Dict[str, list] = defaultdict(list)

# Password brute force protection storage
# Format: {"ip:token": [{"timestamp": datetime, "success": bool}, ...]}
password_attempts: Dict[str, list] = defaultdict(list)

# Brute force protection constants
MAX_PASSWORD_ATTEMPTS = 5  # Max failed attempts before lockout
LOCKOUT_DURATION_MINUTES = 60  # Lockout duration in minutes
PROGRESSIVE_DELAY_ENABLED = True  # Enable progressive delays

# Security constants
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
MAX_FILENAME_LENGTH = 255
ALLOWED_FILE_EXTENSIONS = {
    # Documents
    '.pdf', '.doc', '.docx', '.txt', '.md', '.rtf', '.odt',
    # Images
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp',
    # Archives
    '.zip', '.rar', '.7z', '.tar', '.gz',
    # Media
    '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv',
    # Data
    '.json', '.xml', '.csv', '.xlsx', '.xls',
    # Other
    '.ppt', '.pptx', '.key'
}

# Rate limits (requests per minute)
# These values are the *intended* per-IP budgets.  Enforcement is done at the
# route level via check_rate_limit(); this dict serves as a single source of
# truth for auditing and documentation purposes.
RATE_LIMITS = {
    "/upload": 10,
    "/seal": 10,
    "/info/": 30,          # public metadata probe — header-only, no crypto work
    "/decrypt/": 10,       # client-side decrypt — kept low: each hit triggers PBKDF2
    "/decrypt-upload": 20,
    "/share/": 30,
}


def validate_filename(filename: str) -> bool:
    """Validate filename for security"""
    if not filename or len(filename) > MAX_FILENAME_LENGTH:
        return False
    
    # Block path traversal attempts
    if '..' in filename or '/' in filename or '\\' in filename:
        return False
    
    # Block null bytes
    if '\x00' in filename:
        return False
    
    # Check for valid characters (alphanumeric, spaces, dots, dashes, underscores, parentheses, brackets)
    if not re.match(r'^[\w\s\-\.\(\)\[\]]+$', filename):
        return False
    
    return True


def validate_file_extension(filename: str) -> bool:
    """Check if file extension is allowed"""
    ext = os.path.splitext(filename)[1].lower()
    return ext in ALLOWED_FILE_EXTENSIONS if ext else False


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent security issues"""
    # Remove path components
    filename = os.path.basename(filename)
    
    # Remove null bytes
    filename = filename.replace('\x00', '')
    
    # Replace spaces with underscores
    filename = filename.replace(' ', '_')
    
    # Keep only safe characters
    filename = re.sub(r'[^\w\-\.]', '', filename)
    
    # Limit length
    if len(filename) > MAX_FILENAME_LENGTH:
        name, ext = os.path.splitext(filename)
        filename = name[:MAX_FILENAME_LENGTH - len(ext)] + ext
    
    return filename


def check_rate_limit(request: Request, limit: int = 60) -> None:
    """
    Simple rate limiting based on IP address.
    In production, use Redis or a proper rate limiting service.
    """
    # Guard: request.client can be None when the connection comes through
    # certain proxy configurations or test clients.
    if request.client is None:
        # Cannot rate-limit without an IP — allow the request but log it.
        return

    client_ip = request.client.host
    check_rate_limit_keyed(client_ip, limit=limit, window_seconds=60)


def check_rate_limit_keyed(key: str, limit: int = 60, window_seconds: int = 60) -> None:
    """
    Rate limiting keyed on an arbitrary string (e.g. ``"otp:token:ip"``).

    Unlike :func:`check_rate_limit` this function accepts an explicit key so
    callers can maintain independent rate-limit buckets for different
    (resource, IP) combinations without interfering with the global per-IP
    counter.

    Args:
        key:            Arbitrary string key for the rate-limit bucket.
        limit:          Maximum number of allowed requests per window.
        window_seconds: Length of the sliding window in seconds.

    Raises:
        HTTPException 429 if the bucket is exhausted.
    """
    current_time = datetime.now()
    cutoff_time = current_time - timedelta(seconds=window_seconds)

    # Evict timestamps outside the current window.
    rate_limit_storage[key] = [
        ts for ts in rate_limit_storage[key] if ts > cutoff_time
    ]

    if len(rate_limit_storage[key]) >= limit:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Please try again later."
        )

    rate_limit_storage[key].append(current_time)




def check_password_brute_force(client_ip: str, resource_id: str = None) -> tuple[bool, int, str]:
    """
    Check if IP is locked out due to too many failed password attempts.
    
    Args:
        client_ip: Client's IP address
        resource_id: Optional resource identifier (token/bar_id)
        
    Returns:
        Tuple of (is_locked_out, failed_attempts_count, lockout_message)
        
    Raises:
        HTTPException: If client is locked out (429 Too Many Requests)
    """
    key = f"{client_ip}:{resource_id}" if resource_id else client_ip
    current_time = datetime.now()
    lockout_cutoff = current_time - timedelta(minutes=LOCKOUT_DURATION_MINUTES)
    
    # Clean up old attempts (older than lockout duration)
    password_attempts[key] = [
        attempt for attempt in password_attempts[key]
        if attempt["timestamp"] > lockout_cutoff
    ]
    
    # Count recent failed attempts
    failed_attempts = [
        attempt for attempt in password_attempts[key]
        if not attempt.get("success", False)
    ]
    
    # Check if locked out
    if len(failed_attempts) >= MAX_PASSWORD_ATTEMPTS:
        # Calculate time remaining in lockout
        oldest_failed = min(failed_attempts, key=lambda x: x["timestamp"])
        lockout_expires = oldest_failed["timestamp"] + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
        time_remaining = lockout_expires - current_time
        
        minutes_remaining = int(time_remaining.total_seconds() / 60)
        
        message = (
            f"Too many failed password attempts. "
            f"Account locked for {minutes_remaining} minutes. "
            f"Please try again later."
        )
        
        raise HTTPException(
            status_code=429,
            detail=message
        )
    
    return False, len(failed_attempts), ""


def record_password_attempt(client_ip: str, success: bool, resource_id: str = None) -> None:
    """
    Record a password attempt (success or failure).
    
    Args:
        client_ip: Client's IP address
        success: Whether the password was correct
        resource_id: Optional resource identifier (token/bar_id)
    """
    key = f"{client_ip}:{resource_id}" if resource_id else client_ip
    
    password_attempts[key].append({
        "timestamp": datetime.now(),
        "success": success
    })
    
    # If successful, clear failed attempts for this IP+resource
    if success:
        password_attempts[key] = [
            attempt for attempt in password_attempts[key]
            if attempt.get("success", False)
        ]


def get_progressive_delay(failed_attempts: int) -> float:
    """
    Calculate progressive delay based on number of failed attempts.
    Makes brute force attacks exponentially slower.
    
    Args:
        failed_attempts: Number of failed attempts
        
    Returns:
        Delay in seconds to apply before next attempt
    """
    if not PROGRESSIVE_DELAY_ENABLED or failed_attempts < 1:
        return 0.0
    
    # Progressive delay formula: 2^(attempts-1) seconds
    # 1st fail: 1s, 2nd: 2s, 3rd: 4s, 4th: 8s, 5th: 16s
    delay = min(2 ** (failed_attempts - 1), 30)  # Cap at 30 seconds
    
    return delay


async def check_and_delay_password_attempt(client_ip: str, resource_id: str = None) -> int:
    """
    Check brute force status and apply progressive delay if needed.

    This is an async function because the delay is applied with ``asyncio.sleep``
    to avoid blocking the event loop.  Callers **must** ``await`` this function.
    Calling it without ``await`` (or with the old synchronous ``time.sleep``) would
    freeze the entire uvicorn event loop, hanging every concurrently pending request.
    
    Args:
        client_ip: Client's IP address
        resource_id: Optional resource identifier
        
    Returns:
        Number of failed attempts so far
        
    Raises:
        HTTPException: If client is locked out
    """
    import asyncio
    
    # Check if locked out (raises HTTPException if so)
    _, failed_count, _ = check_password_brute_force(client_ip, resource_id)
    
    # Apply progressive delay — MUST use asyncio.sleep, not time.sleep.
    # time.sleep() is synchronous and blocks the entire event loop; asyncio.sleep()
    # yields control back to the loop so other requests continue to be served.
    if failed_count > 0:
        delay = get_progressive_delay(failed_count)
        if delay > 0:
            await asyncio.sleep(delay)
    
    return failed_count


async def validate_file_size_streaming(file, max_size: int) -> int:
    """
    Validate uploaded file size by streaming it in chunks.

    Reads the file progressively rather than loading it all into memory first,
    so an oversized upload is rejected early without exhausting server RAM.

    Args:
        file: FastAPI ``UploadFile`` object (must be seekable or freshly opened).
        max_size: Maximum allowed size in bytes.

    Returns:
        Total file size in bytes.

    Raises:
        HTTPException 413 if the file exceeds ``max_size``.
    """
    total = 0
    chunk_size = 64 * 1024  # 64 KB chunks
    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        total += len(chunk)
        if total > max_size:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size is {max_size // (1024 * 1024)} MB."
            )
    # Seek back to the beginning so callers can re-read the file
    await file.seek(0)
    return total


def add_security_headers(response: Response) -> Response:
    """Add comprehensive security headers to response"""
    # Prevent clickjacking - DENY means no framing at all
    response.headers["X-Frame-Options"] = "DENY"
    
    # Prevent MIME sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    
    # Enable XSS protection (legacy but doesn't hurt)
    response.headers["X-XSS-Protection"] = "1; mode=block"
    
    # Referrer policy - don't leak URLs to external sites
    response.headers["Referrer-Policy"] = "no-referrer"
    
    # Content Security Policy - strict defaults
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: blob: https:; "
        "font-src 'self' data: https:; "
        f"connect-src 'self' {frontend_url}; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'; "
        "upgrade-insecure-requests;"
    )
    
    # Strict Transport Security - force HTTPS for 1 year
    if os.getenv("RENDER") or os.getenv("IS_PRODUCTION"):
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    
    # Permissions Policy - disable dangerous features
    response.headers["Permissions-Policy"] = (
        "camera=(), "
        "microphone=(), "
        "geolocation=(), "
        "payment=(), "
        "usb=(), "
        "magnetometer=(), "
        "gyroscope=(), "
        "accelerometer=()"
    )
    
    # Cross-Origin policies for isolation
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
    response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
    
    return response


def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Validate password strength
    Returns (is_valid, error_message)
    """
    if not password:
        return True, ""  # Optional password
    
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    
    if len(password) > 128:
        return False, "Password is too long (max 128 characters)"
    
    # Check for variety (at least 2 of: uppercase, lowercase, digit, special)
    has_lower = bool(re.search(r'[a-z]', password))
    has_upper = bool(re.search(r'[A-Z]', password))
    has_digit = bool(re.search(r'\d', password))
    has_special = bool(re.search(r'[!@#$%^&*(),.?":{}|<>]', password))
    
    variety_count = sum([has_lower, has_upper, has_digit, has_special])
    
    if variety_count < 2:
        return False, "Password must contain at least 2 of: lowercase, uppercase, digit, special character"
    
    return True, ""


def _resolve_and_classify(hostname: str) -> bool:
    """
    Resolve *hostname* to all of its IP addresses and return ``True`` if **any**
    of them fall into a protected range that must not be reachable from the
    public internet-facing webhook path.

    Protected ranges (deny if ANY resolved address matches):
    - Loopback          — 127.0.0.0/8, ::1
    - Unspecified       — 0.0.0.0, ::
    - Private (RFC1918) — 10/8, 172.16/12, 192.168/16
    - Link-local        — 169.254.0.0/16, fe80::/10
    - ULA (IPv6)        — fc00::/7
    - Multicast         — 224.0.0.0/4, ff00::/8
    - Reserved / future — anything else flagged by ipaddress

    Design choices
    --------------
    *  ``socket.getaddrinfo`` is used instead of ``socket.gethostbyname``
       because the latter is IPv4-only; a domain with **only** an AAAA record
       pointing to ``::1`` (IPv6 loopback) would pass a ``gethostbyname``-based
       check entirely undetected.
    *  We deny if **any** resolved address is internal — the OR-gate is the
       conservative safe choice; an attacker should not be able to inject even
       one internal address among many public ones.
    *  Resolution failures are fail-safe: if we cannot resolve the hostname we
       cannot guarantee it is safe, so we block it.

    Args:
        hostname: Bare hostname or IP literal (brackets stripped for IPv6).

    Returns:
        ``True``  — hostname should be **blocked** (internal / unresolvable).
        ``False`` — hostname resolved and every address is publicly routable.
    """
    # Strip IPv6 brackets that urlparse leaves intact, e.g. "[::1]" → "::1"
    hostname = hostname.strip('[]')

    try:
        # getaddrinfo returns (family, type, proto, canonname, sockaddr) tuples.
        # sockaddr is (host, port) for AF_INET and (host, port, flow, scope) for AF_INET6.
        results = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        # Cannot resolve — fail safe: block the URL.
        logger.warning("SSRF guard: could not resolve hostname '%s' — blocking.", hostname)
        return True

    if not results:
        # Resolver returned an empty set — treat as unresolvable.
        return True

    for _family, _type, _proto, _canonname, sockaddr in results:
        raw_ip = sockaddr[0]
        try:
            addr = ipaddress.ip_address(raw_ip)
        except ValueError:
            # Malformed address from the resolver — fail safe.
            logger.warning("SSRF guard: malformed address '%s' for '%s' — blocking.", raw_ip, hostname)
            return True

        if (
            addr.is_private       # RFC1918 + ULA + loopback (Python ≥3.11 broadened this)
            or addr.is_loopback   # 127.x.x.x / ::1
            or addr.is_link_local # 169.254.x.x / fe80::
            or addr.is_multicast  # 224.x.x.x / ff::
            or addr.is_reserved   # 0.0.0.0 and other IANA-reserved blocks
            or addr.is_unspecified  # 0.0.0.0 / ::
        ):
            logger.warning(
                "SSRF guard: resolved address '%s' for '%s' is internal — blocking.",
                raw_ip, hostname
            )
            return True

    return False  # Every resolved address is publicly routable.


def validate_webhook_url(url: str) -> bool:
    """
    Validate a user-supplied webhook URL for format correctness and SSRF safety.

    Security model
    --------------
    This is a **two-phase** check:

    Phase 1 — Syntactic validation
        * URL must be non-empty.
        * Scheme must be ``https`` in production environments
          (``RENDER`` or ``IS_PRODUCTION`` env-var set).  Plain ``http`` is
          accepted in development so local testing with ngrok or similar is
          not blocked.
        * ``urlparse`` must extract a non-empty hostname.

    Phase 2 — DNS resolution + ``ipaddress`` classification
        * The hostname is resolved with ``socket.getaddrinfo`` (IPv4 + IPv6).
        * **Every** resolved address is checked with the ``ipaddress`` module.
        * The URL is rejected if **any** address is private, loopback,
          link-local, multicast, reserved, or unresolvable.
        * This defeats all IP-encoding bypass vectors: abbreviated loopback
          (``127.1``), octal (``0177.0.0.1``), decimal (``2130706433``),
          IPv6 loopback (``::1``), IPv6 ULA (``fc00::/7``), link-local
          (``fe80::/10``), etc.

    DNS-rebinding note
    ------------------
    Validating at upload time cannot fully close the TOCTOU window for DNS
    rebinding.  A second, request-time guard is applied inside
    :class:`services.webhook_service.WebhookService` to reduce that window
    to near-zero.  The only complete mitigation is routing all outbound
    webhook calls through a network-isolated egress proxy.

    Args:
        url: The raw webhook URL string supplied by the client.

    Returns:
        ``True``  — URL is safe / field is empty (webhook is optional).
        ``False`` — URL is malformed or resolves to an internal address.
    """
    if not url:
        return True  # Webhook is an optional field; empty = no-op.

    # ------------------------------------------------------------------ #
    # Phase 1 — Syntactic checks                                          #
    # ------------------------------------------------------------------ #

    is_production = bool(os.getenv("RENDER") or os.getenv("IS_PRODUCTION"))

    parsed = urlparse(url)
    scheme = (parsed.scheme or "").lower()

    # In production, require HTTPS — plain HTTP leaks the payload in transit
    # and prevents TLS-based certificate validation of the target host.
    if is_production:
        if scheme != "https":
            return False
    else:
        if scheme not in ("http", "https"):
            return False

    hostname = parsed.hostname  # urlparse normalises and strips brackets for IPv6
    if not hostname:
        return False

    # ------------------------------------------------------------------ #
    # Phase 2 — DNS resolution + ipaddress classification                 #
    # ------------------------------------------------------------------ #

    if _resolve_and_classify(hostname):
        return False

    return True


# ---------------------------------------------------------------------------
# Safe error-response helpers
# ---------------------------------------------------------------------------

# The single opaque message returned to clients on any unhandled 500.
# Using a *public* constant (no leading underscore) ensures every call-site
# can import and reference it directly without calling a wrapper function.
# There is no environment switch — even in development we never echo raw
# exception text into HTTP responses (server logs cover that need).
OPAQUE_500_DETAIL = "An internal error occurred."

# Backward-compatible alias kept so any external code that imported the
# private name continues to work without modification.
_OPAQUE_500_DETAIL = OPAQUE_500_DETAIL


def sanitize_error_message() -> str:
    """
    Return the safe, opaque 500 detail constant.

    Prefer importing :data:`OPAQUE_500_DETAIL` directly.  This function
    exists purely as a convenience wrapper; it accepts no arguments because
    the error string must **never** reach the HTTP response — it must be
    emitted to server logs via ``logger.exception(...)`` before this is
    called so on-call engineers can diagnose the failure without exposing
    internal details to clients.

    Returns:
        A static, human-readable string that contains no implementation detail.
    """
    return OPAQUE_500_DETAIL


# ---------------------------------------------------------------------------
# HTTP header safety helpers
# ---------------------------------------------------------------------------

# Regex matching every character that can terminate or fold an HTTP header
# line — not just the obvious ASCII CRLF pair, but also:
#   \x00  — null byte         (breaks many HTTP parsers outright)
#   \x85  — NEXT LINE (NEL)   (Unicode line terminator, C1 control)
#   \u2028 — LINE SEPARATOR   (Unicode Zl category)
#   \u2029 — PARAGRAPH SEP    (Unicode Zp category)
# Some HTTP/1.1 intermediaries (load balancers, CDNs, WAFs) fold on NEL or
# LS/PS in addition to the standard CR/LF.  Stripping all of them is the
# safe default for header values that embed user-controlled strings.
_HEADER_UNSAFE = re.compile(r'[\r\n\x00\x85\u2028\u2029]')

# Maximum safe byte-length for the *filename* portion of the header value.
# We cap at 200 characters — well under the 255-byte filesystem limit and
# leaves ample room for the surrounding header boilerplate within the ~8 KB
# per-header limit imposed by most HTTP proxies and web servers.
_MAX_FILENAME_CHARS = 200

# RFC 5987 / RFC 8187 §3.2.1  attr-char  (verbatim from the ABNF):
#   attr-char = ALPHA / DIGIT
#             / "!" / "#" / "$" / "&" / "+" / "-" / "."
#             / "^" / "_" / "`" / "|" / "~"
# NOTE: the backtick (0x60) is in the RFC but causes rendering artefacts in
# some terminals and curl versions.  We keep it for strict spec compliance
# but note this choice.  Spaces, quotes, semicolons, equals-signs, and
# percent-signs must never appear unencoded in the extended value.
_RFC5987_SAFE = "!#$&+-.^_`|~"

# ---------------------------------------------------------------------------
# Metadata header sanitisation
# ---------------------------------------------------------------------------

# Exhaustive list of fields that are safe to transmit in the X-BAR-Metadata
# response header.  Any field NOT listed here is silently dropped before
# serialisation.
#
# Design rationale — allowlist vs denylist
# ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
# A denylist (strip only the known-bad keys) is fragile: future metadata
# fields added by developers would automatically be published to every
# browser/extension/cross-origin script that can read CORS-exposed headers
# until someone notices and updates the denylist.  An allowlist fails
# *closed* — new fields are invisible to clients until they are explicitly
# reviewed and added here.
#
# Sensitive fields that must NEVER appear in this set:
#   password_hash  — REMOVED from the .bar format (C-02 fix).  No longer
#                    written to new files.  Still blocked here for backward
#                    compatibility with legacy .bar files that pre-date the fix.
#   webhook_url    — internal notification endpoint; SSRF & info-disclosure.
#   file_hash      — SHA-256 fingerprint of the plaintext; content oracle.
#   encryption_method — hints at key-derivation scheme; aids key-recovery.
#
# Safe fields (all non-sensitive, UI-facing):
_METADATA_HEADER_ALLOWLIST: frozenset[str] = frozenset({
    "filename",
    "created_at",
    "expires_at",
    "max_views",
    "current_views",
    "password_protected",
    "view_only",
    "storage_mode",
    "version",
})


def build_safe_metadata_header(metadata: dict) -> str:
    """
    Serialise a sanitised subset of *metadata* to a JSON string suitable for
    embedding in the ``X-BAR-Metadata`` HTTP response header.

    Security model
    --------------
    Only fields present in :data:`_METADATA_HEADER_ALLOWLIST` are included in
    the output.  All other keys — including ``password_hash``,
    ``webhook_url``, ``file_hash``, and ``encryption_method`` — are **silently
    dropped** so they can never reach:

    * The requesting browser (JavaScript / ``fetch`` API)
    * Browser extensions
    * CORS-enabled cross-origin scripts that can observe the response headers

    The function uses an *allowlist* rather than a denylist so that any new
    metadata field added in the future is automatically excluded from the
    header until it has been explicitly reviewed and added to
    :data:`_METADATA_HEADER_ALLOWLIST`.

    Args:
        metadata: The raw metadata dict returned by the decryption pipeline.

    Returns:
        A JSON string containing only the safe subset of the metadata,
        ready to be assigned to ``response.headers["X-BAR-Metadata"]``.
    """
    safe_meta = {
        key: value
        for key, value in metadata.items()
        if key in _METADATA_HEADER_ALLOWLIST
    }
    return json.dumps(safe_meta, separators=(',', ':'))


def sanitize_header_value(value: str) -> str:
    """
    Strip characters that could terminate or fold an HTTP response header line.

    Beyond the obvious ASCII CR (``\\r``) and LF (``\\n``), this function also
    removes:

    * ``\\x00`` — null byte (crashes many HTTP parsers)
    * ``\\x85`` — Unicode NEXT LINE / NEL (C1 control, treated as newline by
      some intermediaries)
    * ``\\u2028`` — Unicode LINE SEPARATOR
    * ``\\u2029`` — Unicode PARAGRAPH SEPARATOR

    These Unicode line terminators are not commonly found in legitimate
    filenames but are used in known CRLF-injection bypass payloads targeting
    CDNs and WAFs that translate Unicode line terminators to ASCII line-endings
    before forwarding the response.

    Args:
        value: Raw string to be embedded in an HTTP header field.

    Returns:
        The input string with all line-terminating characters removed.
    """
    return _HEADER_UNSAFE.sub('', value)


def build_content_disposition(
    filename: str,
    disposition: str = 'attachment',
) -> str:
    """
    Build a safe, RFC 6266 / RFC 8187 compliant ``Content-Disposition``
    header value for file-download and inline-display responses.

    Security properties
    -------------------
    * **CRLF / line-terminator injection** — ``\\r``, ``\\n``, ``\\x00``,
      ``\\x85``, U+2028, and U+2029 are stripped before any other processing.
      Without a line terminator the payload cannot break out into a synthetic
      HTTP response header line (CVE class: HTTP response splitting / header
      injection).
    * **Quote injection** — the ``filename="…"`` fallback parameter quotes the
      filename and backslash-escapes any embedded ``"`` or ``\\`` character per
      RFC 7230 §3.2.6, so a rogue quote cannot close the quoted-string early
      and inject extra parameters (e.g. ``; type=text/html``).
    * **Unicode / non-ASCII filenames** — the ``filename*`` extended parameter
      uses RFC 5987 / RFC 8187 UTF-8 percent-encoding, which is the only
      interoperable mechanism for non-ASCII filenames across all modern
      browsers.
    * **Filename length** — the filename is truncated to
      ``_MAX_FILENAME_CHARS`` characters (preserving the extension) before
      building either header parameter, preventing excessively long header
      lines that could be rejected by proxies or used in DoS attempts.
    * **Disposition value guard** — a runtime check ensures only ``attachment``
      or ``inline`` can be produced; any other string raises ``ValueError``
      rather than emitting a malformed or injected directive.

    Format produced
    ---------------
    The header uses the *dual-parameter* pattern recommended by RFC 6266 §4.3::

        attachment; filename="safe_ascii.pdf"; filename*=UTF-8''safe_ascii.pdf

    RFC-compliant clients prefer ``filename*``; legacy HTTP/1.0 clients fall
    back to the quoted ``filename`` parameter.  The ``filename`` parameter is
    always placed first, which is the order preferred by RFC 6266.

    Args:
        filename:    The original filename to embed.  May contain Unicode,
                     spaces, or special characters — all are handled safely.
        disposition: Must be ``'attachment'`` (force download) or ``'inline'``
                     (display in browser).  Defaults to ``'attachment'``.
                     **Validated at runtime** — any other value raises
                     ``ValueError``.

    Returns:
        A fully-formed ``Content-Disposition`` header value string ready to be
        assigned to ``response.headers["Content-Disposition"]``.

    Raises:
        ValueError: If *disposition* is not ``'attachment'`` or ``'inline'``.
    """
    # ------------------------------------------------------------------ #
    # 0. Runtime guard on disposition                                      #
    # ------------------------------------------------------------------ #
    if disposition not in ('attachment', 'inline'):
        raise ValueError(
            f"disposition must be 'attachment' or 'inline', got {disposition!r}"
        )

    # ------------------------------------------------------------------ #
    # 1. Normalise: empty → safe default                                  #
    # ------------------------------------------------------------------ #
    if not filename or not filename.strip():
        filename = 'download'

    # ------------------------------------------------------------------ #
    # 2. Strip all HTTP line-terminator characters                        #
    #    (primary CRLF/NEL/LS/PS injection defence — must happen first)  #
    # ------------------------------------------------------------------ #
    filename = sanitize_header_value(filename)

    # ------------------------------------------------------------------ #
    # 3. Truncate to a safe length, preserving the file extension         #
    #    so the browser still applies the correct default application.   #
    # ------------------------------------------------------------------ #
    if len(filename) > _MAX_FILENAME_CHARS:
        name_part, ext_part = os.path.splitext(filename)
        # Reserve space for the extension (including its leading dot).
        max_name = _MAX_FILENAME_CHARS - len(ext_part)
        filename = name_part[:max(max_name, 1)] + ext_part

    # ------------------------------------------------------------------ #
    # 4. Build the quoted ASCII fallback for the filename="" parameter    #
    #                                                                     #
    #    RFC 7230 §3.2.6 quoted-string accepts:                          #
    #      qdtext = HTAB / SP / %x21 / %x23-5B / %x5D-7E / obs-text     #
    #    where obs-text (0x80–0xFF) should NOT be relied upon — many      #
    #    intermediaries reject or mis-decode opaque octets in header      #
    #    values.  We therefore restrict the fallback strictly to 7-bit    #
    #    printable ASCII (0x20–0x7E, excluding DEL=0x7F).                #
    #                                                                     #
    #    Characters outside that range are approximated via Unicode       #
    #    NFKD decomposition (é → e, Ä → A, 日 → _, 🔥 → _) so the       #
    #    fallback is always a readable, valid ASCII string even when the  #
    #    original filename is entirely non-Latin.                         #
    #                                                                     #
    #    Any literal '"' or '\' inside the filename is backslash-escaped  #
    #    to prevent premature closing of the quoted-string.              #
    # ------------------------------------------------------------------ #
    ascii_parts: list[str] = []
    for ch in filename:
        code = ord(ch)
        if 0x20 <= code <= 0x7E:          # printable 7-bit ASCII (safe)
            if ch in ('"', '\\'):
                ascii_parts.append('\\')  # RFC 7230 quoted-pair escape
            ascii_parts.append(ch)
        else:
            # Attempt NFKD decomposition to recover a Latin ASCII base
            # letter (e.g. é→e, ü→u, Ä→A, ñ→n).  Strip combining marks
            # and anything that is still outside 0x20–0x7E.
            nfkd = unicodedata.normalize('NFKD', ch)
            base = ''.join(c for c in nfkd if 0x20 <= ord(c) <= 0x7E)
            ascii_parts.append(base if base else '_')

    ascii_fallback = ''.join(ascii_parts)

    # Ensure the fallback is never empty after all transformations.
    if not ascii_fallback:
        ascii_fallback = 'download'

    # ------------------------------------------------------------------ #
    # 5. Build the RFC 5987 / RFC 8187 percent-encoded extended value     #
    #    for the filename*= parameter (full Unicode support).             #
    #                                                                     #
    #    safe= contains the exact attr-char set from RFC 8187 §3.2.1.   #
    #    Every other byte (including spaces, quotes, semicolons, etc.)   #
    #    becomes a %XX escape sequence.                                   #
    # ------------------------------------------------------------------ #
    encoded = quote(filename.encode('utf-8'), safe=_RFC5987_SAFE)

    return f'{disposition}; filename="{ascii_fallback}"; filename*=UTF-8\'\'{encoded}'

