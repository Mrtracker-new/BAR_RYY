"""
Security utilities and middleware for BAR Web API
"""
from fastapi import Request, HTTPException
from fastapi.responses import Response
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Dict
import re
import os

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
RATE_LIMITS = {
    "/upload": 10,
    "/seal": 10,
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


async def validate_file_size_streaming(file, max_size: int = None) -> int:
    """
    Validate file size while streaming to prevent memory exhaustion.
    
    Args:
        file: FastAPI UploadFile object
        max_size: Maximum allowed size in bytes (defaults to MAX_FILE_SIZE)
        
    Returns:
        Total file size in bytes
        
    Raises:
        HTTPException: If file exceeds max_size
    """
    from fastapi import UploadFile
    
    if max_size is None:
        max_size = MAX_FILE_SIZE
    
    total_size = 0
    chunk_size = 1024 * 1024  # 1MB chunks
    
    # Read file in chunks to check size without loading entire file
    while chunk := await file.read(chunk_size):
        total_size += len(chunk)
        if total_size > max_size:
            raise HTTPException(
                status_code=413,
                detail=f"File too large (max {max_size // 1024 // 1024}MB)"
            )
    
    # Reset file pointer to beginning for subsequent reads
    await file.seek(0)
    
    return total_size


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
    Simple rate limiting based on IP address
    In production, use Redis or a proper rate limiting service
    """
    client_ip = request.client.host
    current_time = datetime.now()
    
    # Clean up old entries (older than 1 minute)
    cutoff_time = current_time - timedelta(minutes=1)
    rate_limit_storage[client_ip] = [
        timestamp for timestamp in rate_limit_storage[client_ip]
        if timestamp > cutoff_time
    ]
    
    # Check rate limit
    if len(rate_limit_storage[client_ip]) >= limit:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Please try again later."
        )
    
    # Add current request
    rate_limit_storage[client_ip].append(current_time)


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


def check_and_delay_password_attempt(client_ip: str, resource_id: str = None) -> int:
    """
    Check brute force status and apply progressive delay if needed.
    
    Args:
        client_ip: Client's IP address
        resource_id: Optional resource identifier
        
    Returns:
        Number of failed attempts so far
        
    Raises:
        HTTPException: If client is locked out
    """
    import time
    
    # Check if locked out
    _, failed_count, _ = check_password_brute_force(client_ip, resource_id)
    
    # Apply progressive delay
    if failed_count > 0:
        delay = get_progressive_delay(failed_count)
        if delay > 0:
            time.sleep(delay)
    
    return failed_count


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


def validate_webhook_url(url: str) -> bool:
    """
    Validate webhook URL with comprehensive SSRF protection.
    
    Blocks:
    - Private IP ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
    - Loopback addresses (127.x.x.x, localhost)
    - Link-local addresses (169.254.x.x)
    - Cloud metadata endpoints (169.254.169.254)
    - DNS rebinding attacks via DNS resolution
    """
    if not url:
        return True  # Optional
    
    # Basic URL validation
    url_pattern = re.compile(
        r'^https?://'  # http:// or https://
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain
        r'localhost|'  # localhost
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # or IP
        r'(?::\d+)?'  # optional port
        r'(?:/?|[/?]\S+)$', re.IGNORECASE)
    
    if not url_pattern.match(url):
        return False
    
    # Enhanced SSRF protection in production
    if os.getenv("RENDER") or os.getenv("IS_PRODUCTION"):
        from urllib.parse import urlparse
        import socket
        import ipaddress
        
        try:
            # Parse URL and extract hostname
            parsed = urlparse(url)
            hostname = parsed.hostname
            
            if not hostname:
                return False
            
            # Block localhost explicitly
            if hostname.lower() in ['localhost', '0.0.0.0']:
                return False
            
            # Check if hostname is already an IP address
            try:
                ip_obj = ipaddress.ip_address(hostname)
                # It's a direct IP - validate it
                if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
                    return False
                if ip_obj.is_reserved or ip_obj.is_multicast:
                    return False
                if str(ip_obj) == "169.254.169.254":
                    return False
                if hasattr(ip_obj, 'is_global') and not ip_obj.is_global:
                    return False
                return True
            except ValueError:
                # Not a direct IP, it's a hostname - continue to DNS resolution
                pass
            
            # Resolve DNS to get actual IP address (prevents DNS rebinding)
            try:
                ip = socket.gethostbyname(hostname)
            except (socket.gaierror, socket.herror, OSError):
                # DNS resolution failed - this could be:
                # 1. Hostname doesn't exist yet (will fail when webhook is called anyway)
                # 2. Network issue
                # 3. Invalid hostname
                # We'll allow it to proceed - if it's invalid, the webhook call will fail
                # But we should still block obvious private hostname patterns
                if any(pattern in hostname.lower() for pattern in [
                    'localhost', '127.', '.local', '.internal', 'consul', 
                    '169.254.', '192.168.', '10.', '172.16.', '172.17.',
                    '172.18.', '172.19.', '172.20.', '172.21.', '172.22.',
                    '172.23.', '172.24.', '172.25.', '172.26.', '172.27.',
                    '172.28.', '172.29.', '172.30.', '172.31.'
                ]):
                    return False
                return True
            
            # Parse resolved IP address
            try:
                ip_obj = ipaddress.ip_address(ip)
            except ValueError:
                # Invalid IP address from DNS
                return False
            
            # Block private IP ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
            if ip_obj.is_private:
                return False
            
            # Block loopback addresses (127.x.x.x, ::1)
            if ip_obj.is_loopback:
                return False
            
            # Block link-local addresses (169.254.x.x, fe80::/10)
            if ip_obj.is_link_local:
                return False
            
            # Block reserved/multicast addresses
            if ip_obj.is_reserved or ip_obj.is_multicast:
                return False
            
            # Explicitly block cloud metadata endpoint
            if str(ip) == "169.254.169.254":
                return False
            
            # Block IPv6 unique local addresses (fc00::/7)
            if hasattr(ip_obj, 'is_global') and not ip_obj.is_global:
                return False
                
        except Exception:
            # If any unexpected error occurs during validation, reject the URL
            return False
    
    return True


def sanitize_error_message(error: str) -> str:
    """Sanitize error messages to avoid information disclosure"""
    # In production, return generic messages
    if os.getenv("RENDER") or os.getenv("IS_PRODUCTION"):
        if "file not found" in error.lower():
            return "Resource not found"
        if "permission" in error.lower():
            return "Access denied"
        if "database" in error.lower() or "sql" in error.lower():
            return "Internal server error"
        return "An error occurred. Please try again."
    
    # In development, return full error
    return error
