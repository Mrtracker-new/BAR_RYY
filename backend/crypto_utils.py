import os
import json
import base64
import hmac
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
from datetime import datetime, timedelta
import hashlib


class TamperDetectedException(Exception):
    """Exception raised when BAR file tampering is detected"""
    pass


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


def generate_session_fingerprint(token: str, ip_address: str, user_agent: str) -> str:
    """
    Generate privacy-respecting session fingerprint for view tracking.
    
    Args:
        token: File access token (prevents cross-file tracking)
        ip_address: Client IP address
        user_agent: Client User-Agent string
        
    Returns:
        16-character hex fingerprint (first 16 chars of SHA256 hash)
        
    Security:
        - Includes token to prevent tracking across different files
        - Hashed immediately for privacy
        - Short enough to be efficient, long enough to prevent collisions
        
    Note:
        This is used for view refresh control to identify the same user
        accessing the same file within a time threshold.
    """
    data = f"{token}|{ip_address}|{user_agent}"
    return hashlib.sha256(data.encode()).hexdigest()[:16]


def generate_hmac_signature(data: bytes, key: bytes) -> str:
    """
    Generate HMAC-SHA256 signature for data integrity verification.
    
    Args:
        data: The data to sign (should be the entire BAR structure minus signature)
        key: The encryption key used as HMAC key
        
    Returns:
        Hex-encoded HMAC signature string
        
    Security:
        HMAC provides cryptographic proof that data hasn't been modified.
        Any changes to the data will result in signature mismatch.
    """
    return hmac.new(key, data, hashlib.sha256).hexdigest()


def verify_hmac_signature(data: bytes, key: bytes, signature: str) -> bool:
    """
    Verify HMAC-SHA256 signature to detect tampering.
    
    Args:
        data: The data to verify
        key: The encryption key used as HMAC key
        signature: The expected signature (hex string)
        
    Returns:
        True if signature is valid, raises TamperDetectedException if invalid
        
    Raises:
        TamperDetectedException: If signature doesn't match (file was tampered with)
    """
    expected_signature = hmac.new(key, data, hashlib.sha256).hexdigest()
    
    # Use constant-time comparison to prevent timing attacks
    if not hmac.compare_digest(expected_signature, signature):
        raise TamperDetectedException(
            "BAR file integrity check failed! File has been modified or corrupted. "
            "This could indicate tampering or data corruption."
        )
    
    return True


def secure_delete_file(file_path: str, passes: int = 3) -> None:
    """
    Securely delete a file by overwriting it before deletion.
    
    This prevents data recovery by:
    1. Overwriting with random data (multiple passes)
    2. Overwriting with zeros
    3. Finally unlinking the file
    
    Args:
        file_path: Path to the file to securely delete
        passes: Number of random overwrite passes (default: 3)
    """
    if not os.path.exists(file_path):
        return  # File doesn't exist, nothing to do
    
    try:
        # Get file size
        file_size = os.path.getsize(file_path)
        
        # Open file in write mode
        with open(file_path, "r+b") as f:
            # Pass 1-N: Overwrite with random data
            for _ in range(passes):
                f.seek(0)
                f.write(os.urandom(file_size))
                f.flush()
                os.fsync(f.fileno())  # Force write to disk
            
            # Final pass: Overwrite with zeros
            f.seek(0)
            f.write(b'\x00' * file_size)
            f.flush()
            os.fsync(f.fileno())
        
        # Finally, unlink the file
        os.remove(file_path)
        
    except Exception as e:
        # If secure deletion fails, fall back to normal deletion
        # (Better to delete insecurely than not at all)
        if os.path.exists(file_path):
            os.remove(file_path)
        raise e


def encrypt_and_pack_with_password(file_data: bytes, metadata: dict, password: str) -> tuple:
    """
    High-level function to encrypt and pack a file with password-derived encryption.
    This is the recommended way to create password-protected .BAR files.
    
    Args:
        file_data: Original file data (unencrypted)
        metadata: File metadata dictionary
        password: Password for encryption
        
    Returns:
        Tuple of (bar_data, salt, key) where:
        - bar_data: Complete .BAR file data ready to save
        - salt: The salt used (for reference)
        - key: The derived encryption key (for reference)
    """
    # Generate random salt
    salt = os.urandom(32)
    
    # Derive key from password and salt
    key = derive_key_from_password(password, salt)
    
    # Encrypt file data
    encrypted_data = encrypt_file(file_data, key)
    
    # Pack into .BAR file with password-derived method
    bar_data = pack_bar_file(encrypted_data, metadata, key, password=password, salt=salt)
    
    return bar_data, salt, key


def pack_bar_file(encrypted_data: bytes, metadata: dict, key: bytes, password: str = None, salt: bytes = None) -> bytes:
    """
    Pack encrypted file and metadata into BAR format.
    
    Args:
        encrypted_data: The encrypted file data (must be encrypted with the provided key)
        metadata: File metadata dictionary
        key: Encryption key (used for encryption)
        password: Optional password for password-derived encryption
        salt: Optional salt (required if password is provided)
        
    Returns:
        BAR file data as bytes
        
    Security:
        - If password is provided: Uses password-derived encryption (zero-knowledge)
          Only salt is stored, key must be derived from password each time
        - If password is None: Stores key in file (backward compatible, less secure)
        
    Note:
        For password-protected files, use encrypt_and_pack_with_password() instead.
        This function is lower-level and requires you to manage salt/key derivation yourself.
    """
    # Create BAR file structure
    bar_structure = {
        "metadata": metadata,
        "encrypted_data": base64.b64encode(encrypted_data).decode('utf-8')
    }
    
    # Determine encryption method based on password
    if password:
        # Password-derived encryption: Store only salt, NOT the key!
        # This is true zero-knowledge encryption
        
        if salt is None:
            raise ValueError("Salt is required when password is provided")
        
        bar_structure["encryption_method"] = "password_derived"
        bar_structure["salt"] = base64.b64encode(salt).decode('utf-8')
        # ⚠️ Key is NOT stored! Must be derived from password each time
    else:
        # Legacy mode: Store key in file (less secure, backward compatible)
        bar_structure["encryption_method"] = "key_stored"
        bar_structure["encryption_key"] = base64.b64encode(key).decode('utf-8')
    
    # Generate HMAC signature for integrity verification
    # Sign the entire structure (metadata + encrypted_data + salt/key)
    # Use consistent JSON formatting for signing and verification
    bar_json_for_signing = json.dumps(bar_structure, sort_keys=True, separators=(',', ':'))
    signature = generate_hmac_signature(bar_json_for_signing.encode('utf-8'), key)
    bar_structure["hmac_signature"] = signature
    
    # Convert to JSON and encode (now includes signature)
    # Use pretty printing for human readability, but signature is already computed
    bar_json = json.dumps(bar_structure, indent=2)
    bar_bytes = bar_json.encode('utf-8')
    
    # Obfuscate: Base64 encode the JSON so it's not readable in text editors
    obfuscated_data = base64.b64encode(bar_bytes)
    
    # Add BAR file header
    header = b"BAR_FILE_V1\n"
    return header + obfuscated_data


def unpack_bar_file(bar_data: bytes, password: str = None) -> tuple:
    """
    Unpack BAR file into components.
    
    Args:
        bar_data: Raw BAR file data
        password: Optional password for password-derived encryption
        
    Returns:
        Tuple of (encrypted_data, metadata, key)
        
    Security:
        - For password_derived files: Derives key from password and salt
        - For key_stored files: Extracts key from file (backward compatible)
        
    Raises:
        ValueError: If file format is invalid
        ValueError: If password is required but not provided
        ValueError: If password-derived encryption is used but no password given
    """
    # Remove header
    if not bar_data.startswith(b"BAR_FILE_V1\n"):
        raise ValueError("Invalid BAR file format")
    
    obfuscated_data = bar_data[12:]  # Remove header
    
    # Deobfuscate: Base64 decode to get the JSON
    bar_json = base64.b64decode(obfuscated_data)
    bar_structure = json.loads(bar_json.decode('utf-8'))
    
    metadata = bar_structure["metadata"]
    encrypted_data = base64.b64decode(bar_structure["encrypted_data"])
    
    # Determine encryption method
    encryption_method = bar_structure.get("encryption_method", "key_stored")  # Default to legacy
    
    if encryption_method == "password_derived":
        # Password-derived encryption: Must derive key from password
        if not password:
            raise ValueError("Password required for decryption")
        
        # Verify password FIRST if password_hash exists (before key derivation)
        # This prevents false "tampering detected" errors when password is wrong
        if "password_hash" in metadata:
            import hashlib
            provided_hash = hashlib.sha256(password.encode()).hexdigest()
            stored_hash = metadata["password_hash"]
            if provided_hash != stored_hash:
                raise ValueError("Invalid password")
        
        # Get salt from file
        salt = base64.b64decode(bar_structure["salt"])
        
        # Derive key from password and salt
        key = derive_key_from_password(password, salt)
        
    else:
        # Legacy mode: Key is stored in file
        key = base64.b64decode(bar_structure["encryption_key"])
    
    # Verify HMAC signature for integrity (if present)
    if "hmac_signature" in bar_structure:
        stored_signature = bar_structure["hmac_signature"]
        
        # Reconstruct the structure without signature for verification
        # MUST use same JSON formatting as during signing
        structure_for_verification = {k: v for k, v in bar_structure.items() if k != "hmac_signature"}
        verification_json = json.dumps(structure_for_verification, sort_keys=True, separators=(',', ':'))
        
        # Verify signature - will raise TamperDetectedException if invalid
        verify_hmac_signature(verification_json.encode('utf-8'), key, stored_signature)
    else:
        # No signature present - old file format (pre-HMAC)
        # Issue warning but allow it for backward compatibility
        import warnings
        warnings.warn(
            "BAR file does not contain HMAC signature (old format). "
            "Tampering cannot be detected. Consider re-encrypting with current version.",
            UserWarning
        )
    
    return encrypted_data, metadata, key


# DEPRECATED: Use client_storage.validate_client_access() or server_storage.validate_server_access() instead
