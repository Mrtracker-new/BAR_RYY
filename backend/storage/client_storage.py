"""
Hey! This is the CLIENT-SIDE storage module 📥

This handles .bar files that users download and keep on their own computers.
Since they have the file, we can't really stop them from opening it multiple times.
So we DON'T enforce view count limits here - it's just not possible!

What we CAN do:
- Check if the file has expired ⏰
- Make sure they enter the right password 🔒

That's about it for client-side files!
"""

from datetime import datetime, timedelta
from typing import Optional, Tuple


def create_client_metadata(
    filename: str,
    expiry_minutes: int,
    password_protected: bool,
    webhook_url: Optional[str] = None,
    view_only: bool = False
) -> dict:
    """Create metadata for a client-side .bar file (the downloadable kind!)"""
    created_at = datetime.utcnow().isoformat() + 'Z'
    expires_at = None
    
    if expiry_minutes > 0:
        expires_at = (datetime.utcnow() + timedelta(minutes=expiry_minutes)).isoformat() + 'Z'
    
    # NOTE: `encryption_method` is intentionally absent from this dict.
    # The authoritative `encryption_method` field is written at the *top level*
    # of the BAR structure by `pack_bar_file` (crypto_utils.py) and read from
    # that same top-level location by `unpack_bar_file`.  Duplicating it here
    # inside `bar_structure["metadata"]` would create two independent copies that
    # could silently drift out of sync, giving a false impression that editing the
    # metadata field affects cryptographic behaviour.  It does not — keep it out.
    metadata = {
        "filename": filename,
        "created_at": created_at,
        "expires_at": expires_at,
        "password_protected": password_protected,
        "webhook_url": webhook_url,
        "view_only": view_only,
        "storage_mode": "client",
        "file_hash": "",
        "version": "1.0",
        # 👀 Notice: No max_views or current_views here!
        # Why? Because users can keep copies of the file, so we can't track views anyway
    }
    
    return metadata


def validate_client_access(metadata: dict, password: Optional[str] = None) -> Tuple[bool, list]:
    """
    Time to check if someone can open this client-side .bar file!
    
    We only check:
    ✅ Has it expired? (respect the timer)
    ✅ Did they give us the password? (if there is one)
    
    We DON'T check:
    ❌ View count - can't enforce this for downloaded files anyway!
    """
    errors = []
    
    # Hey, did this file expire? Let's check!
    if metadata.get("expires_at"):
        expires_at_str = metadata["expires_at"]
        if expires_at_str.endswith('Z'):
            expires_at_str = expires_at_str[:-1]  # Remove the Z suffix
        expires_at = datetime.fromisoformat(expires_at_str)
        if datetime.utcnow() > expires_at:
            errors.append("File has expired")  # Too late, buddy!
    
    # Is there a password? Did they give it to us?
    if metadata.get("password_protected") and not password:
        errors.append("Password required")  # Nope, need that password!
    
    return len(errors) == 0, errors


def get_storage_info() -> dict:
    """Tell people what client-side storage can and can't do"""
    return {
        "storage_mode": "client",
        "view_limit_enforcement": False,
        "expiry_support": True,
        "password_support": True,
        "description": "Client-side .bar files are downloadable. Users can keep copies, so view limits cannot be enforced.",
        "warnings": [
            "View count limits are NOT enforced",
            "Users can keep multiple copies of the .bar file",
            "For proper security, use server-side storage"
        ]
    }
