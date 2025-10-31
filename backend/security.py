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
    """Add security headers to response"""
    # Prevent clickjacking
    response.headers["X-Frame-Options"] = "DENY"
    
    # Prevent MIME sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    
    # Enable XSS protection
    response.headers["X-XSS-Protection"] = "1; mode=block"
    
    # Referrer policy
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    
    # Content Security Policy
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: blob:; "
        "font-src 'self' data:; "
        "connect-src 'self'; "
        "frame-ancestors 'none';"
    )
    
    # Strict Transport Security (HTTPS only)
    if os.getenv("RENDER") or os.getenv("IS_PRODUCTION"):  # In production
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    
    # Permissions Policy
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    
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
    """Validate webhook URL"""
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
    
    # Block localhost/private IPs in production (SSRF protection)
    if os.getenv("RENDER") or os.getenv("IS_PRODUCTION"):
        if any(x in url.lower() for x in ['localhost', '127.0.0.1', '0.0.0.0', '192.168.', '10.', '172.16.']):
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
