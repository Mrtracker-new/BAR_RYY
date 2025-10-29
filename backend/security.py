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
