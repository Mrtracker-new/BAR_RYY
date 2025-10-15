import os
import json
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
from datetime import datetime, timedelta
import hashlib


def generate_key_from_bar_id(bar_id: str, salt: bytes) -> bytes:
    """Generate encryption key from BAR ID (acts as password)"""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
        backend=default_backend()
    )
    key = base64.urlsafe_b64encode(kdf.derive(bar_id.encode()))
    return key


def derive_key_from_password(password: str, salt: bytes) -> bytes:
    """Derive encryption key from password using PBKDF2"""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
        backend=default_backend()
    )
    key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
    return key


def encrypt_file(file_data: bytes, key: bytes) -> bytes:
    """Encrypt file data using Fernet encryption"""
    fernet = Fernet(key)
    encrypted_data = fernet.encrypt(file_data)
    return encrypted_data


def decrypt_file(encrypted_data: bytes, key: bytes) -> bytes:
    """Decrypt file data using Fernet encryption"""
    fernet = Fernet(key)
    decrypted_data = fernet.decrypt(encrypted_data)
    return decrypted_data


def create_bar_metadata(filename: str, max_views: int, expiry_minutes: int, 
                        password_protected: bool, webhook_url: str = None, 
                        view_only: bool = False, salt: str = None) -> dict:
    """Create metadata for BAR file - NO ENCRYPTION KEY STORED"""
    created_at = datetime.utcnow().isoformat()
    expires_at = None
    
    if expiry_minutes > 0:
        expires_at = (datetime.utcnow() + timedelta(minutes=expiry_minutes)).isoformat()
    
    metadata = {
        "filename": filename,
        "created_at": created_at,
        "expires_at": expires_at,
        "max_views": max_views,
        "current_views": 0,
        "password_protected": password_protected,
        "webhook_url": webhook_url,
        "view_only": view_only,
        "file_hash": "",
        "salt": salt,  # Store salt for key derivation
        "version": "2.0"  # New version without embedded key
    }
    
    return metadata


def calculate_file_hash(file_data: bytes) -> str:
    """Calculate SHA256 hash of file for integrity checking"""
    return hashlib.sha256(file_data).hexdigest()


def pack_bar_file_secure(encrypted_data: bytes, metadata: dict) -> bytes:
    """Pack encrypted file and metadata - WITHOUT encryption key"""
    bar_structure = {
        "metadata": metadata,
        "encrypted_data": base64.b64encode(encrypted_data).decode('utf-8')
        # NO encryption_key field!
    }
    
    # Convert to JSON and encode
    bar_json = json.dumps(bar_structure, indent=2)
    bar_bytes = bar_json.encode('utf-8')
    
    # Add BAR file header
    header = b"BAR_FILE_V2\n"  # Version 2
    return header + bar_bytes


def unpack_bar_file_secure(bar_data: bytes) -> tuple:
    """Unpack BAR file - returns encrypted data and metadata only"""
    # Check version
    if bar_data.startswith(b"BAR_FILE_V2\n"):
        bar_json = bar_data[12:]  # Remove header
    elif bar_data.startswith(b"BAR_FILE_V1\n"):
        # Old format - still has key embedded (backward compatibility)
        bar_json = bar_data[12:]
        bar_structure = json.loads(bar_json.decode('utf-8'))
        metadata = bar_structure["metadata"]
        key = base64.b64decode(bar_structure["encryption_key"])
        encrypted_data = base64.b64decode(bar_structure["encrypted_data"])
        return encrypted_data, metadata, key
    else:
        raise ValueError("Invalid BAR file format")
    
    bar_structure = json.loads(bar_json.decode('utf-8'))
    
    metadata = bar_structure["metadata"]
    encrypted_data = base64.b64decode(bar_structure["encrypted_data"])
    
    # No key in file!
    return encrypted_data, metadata, None


def validate_bar_access(metadata: dict, password: str = None) -> tuple:
    """Validate if BAR file can be accessed"""
    errors = []
    
    # Check expiry
    if metadata.get("expires_at"):
        expires_at = datetime.fromisoformat(metadata["expires_at"])
        if datetime.utcnow() > expires_at:
            errors.append("File has expired")
    
    # Check max views
    if metadata.get("max_views", 0) > 0:
        if metadata.get("current_views", 0) >= metadata["max_views"]:
            errors.append("Maximum views reached")
    
    # Check password
    if metadata.get("password_protected") and not password:
        errors.append("Password required")
    
    return len(errors) == 0, errors
