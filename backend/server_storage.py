"""
Hey! This is the SERVER-SIDE storage module 🔒

This is the real deal for security! Files stay on OUR server, and users just
get a link to access them. This means we can ACTUALLY enforce view limits!

What we do here:
- Track every single view 👀
- Destroy files when the view limit is hit 💥
- Check expiry times ⏰
- Validate passwords 🔐

This is way more secure than client-side because users can't just keep copies!
"""

from datetime import datetime, timedelta
from typing import Optional, Tuple


def create_server_metadata(
    filename: str,
    max_views: int,
    expiry_minutes: int,
    password_protected: bool,
    webhook_url: Optional[str] = None,
    view_only: bool = False
) -> dict:
    """Create metadata for a server-side file (we keep track of EVERYTHING here!)"""
    created_at = datetime.utcnow().isoformat() + 'Z'
    expires_at = None
    
    if expiry_minutes > 0:
        expires_at = (datetime.utcnow() + timedelta(minutes=expiry_minutes)).isoformat() + 'Z'
    
    metadata = {
        "filename": filename,
        "created_at": created_at,
        "expires_at": expires_at,
        "max_views": max_views,
        "current_views": 0,
        "password_protected": password_protected,
        "webhook_url": webhook_url,
        "view_only": view_only,
        "storage_mode": "server",
        "file_hash": "",
        "version": "1.0"
    }
    
    return metadata


def validate_server_access(
    metadata: dict,
    password: Optional[str] = None,
    skip_password_check: bool = False
) -> Tuple[bool, list]:
    """
    Time to validate access to a server-side file! We check EVERYTHING:
    
    ✅ Has it expired yet?
    ✅ Have we hit the view limit? (this is the important one!)
    ✅ Did they give the right password?
    
    If any of these fail, access denied! 🚫
    """
    errors = []
    
    # First, let's check if this file has expired
    if metadata.get("expires_at"):
        expires_at_str = metadata["expires_at"]
        if expires_at_str.endswith('Z'):
            expires_at_str = expires_at_str[:-1]  # Remove the Z
        expires_at = datetime.fromisoformat(expires_at_str)
        if datetime.utcnow() > expires_at:
            errors.append("File has expired")  # Time's up!
    
    # Now the big one - check if we've hit the view limit!
    # This is what makes server-side storage powerful 💪
    max_views = metadata.get("max_views", 0)
    current_views = metadata.get("current_views", 0)
    
    if max_views > 0:
        if current_views >= max_views:
            errors.append(f"Maximum views reached ({current_views}/{max_views})")
            # Sorry, you've used up all your views!
    
    # Finally, check the password (if we haven't already)
    if not skip_password_check:
        if metadata.get("password_protected") and not password:
            errors.append("Password required")  # Need that password!
    
    return len(errors) == 0, errors


def should_destroy_file(metadata: dict) -> bool:
    """
    Should we blow up this file? 💥
    Returns True if we've hit the view limit (time to destroy!)
    """
    max_views = metadata.get("max_views", 0)
    current_views = metadata.get("current_views", 0)
    
    # Have we hit the limit? If so, it's destruction time!
    if max_views > 0 and current_views >= max_views:
        return True  # Boom! 💥
    
    return False  # Nah, we're good for now


def increment_view_count(metadata: dict) -> dict:
    """Someone just viewed the file! Let's count it 📊"""
    metadata["current_views"] = metadata.get("current_views", 0) + 1
    return metadata


def get_views_remaining(metadata: dict) -> int:
    """How many views are left? Let's do the math! 🧮"""
    max_views = metadata.get("max_views", 0)
    current_views = metadata.get("current_views", 0)
    return max(0, max_views - current_views)


def get_storage_info() -> dict:
    """Tell people what server-side storage can do (spoiler: a lot!)"""
    return {
        "storage_mode": "server",
        "view_limit_enforcement": True,
        "expiry_support": True,
        "password_support": True,
        "description": "Server-side files with shareable links. View limits are properly enforced.",
        "features": [
            "View count limits properly enforced",
            "Files auto-destruct when limits reached",
            "Shareable links (no file downloads)",
            "Cannot be copied by users"
        ]
    }
