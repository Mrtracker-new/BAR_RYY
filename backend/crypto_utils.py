import os
import json
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
from datetime import datetime, timedelta
import hashlib


def generate_key():
    """Generate a new encryption key"""
    return Fernet.generate_key()


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


# DEPRECATED: Use client_storage.create_client_metadata() or server_storage.create_server_metadata() instead


def calculate_file_hash(file_data: bytes) -> str:
    """Calculate SHA256 hash of file for integrity checking"""
    return hashlib.sha256(file_data).hexdigest()


def pack_bar_file(encrypted_data: bytes, metadata: dict, key: bytes) -> bytes:
    """Pack encrypted file and metadata into BAR format"""
    # Create BAR file structure
    bar_structure = {
        "metadata": metadata,
        "encryption_key": base64.b64encode(key).decode('utf-8'),
        "encrypted_data": base64.b64encode(encrypted_data).decode('utf-8')
    }
    
    # Convert to JSON and encode
    bar_json = json.dumps(bar_structure, indent=2)
    bar_bytes = bar_json.encode('utf-8')
    
    # Obfuscate: Base64 encode the JSON so it's not readable in text editors
    obfuscated_data = base64.b64encode(bar_bytes)
    
    # Add BAR file header
    header = b"BAR_FILE_V1\n"
    return header + obfuscated_data


def unpack_bar_file(bar_data: bytes) -> tuple:
    """Unpack BAR file into components"""
    # Remove header
    if not bar_data.startswith(b"BAR_FILE_V1\n"):
        raise ValueError("Invalid BAR file format")
    
    obfuscated_data = bar_data[12:]  # Remove header
    
    # Deobfuscate: Base64 decode to get the JSON
    bar_json = base64.b64decode(obfuscated_data)
    bar_structure = json.loads(bar_json.decode('utf-8'))
    
    metadata = bar_structure["metadata"]
    key = base64.b64decode(bar_structure["encryption_key"])
    encrypted_data = base64.b64decode(bar_structure["encrypted_data"])
    
    return encrypted_data, metadata, key


# DEPRECATED: Use client_storage.validate_client_access() or server_storage.validate_server_access() instead
