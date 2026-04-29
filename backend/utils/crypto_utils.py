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

# ---------------------------------------------------------------------------
# BAR file canonical JSON contract
# ---------------------------------------------------------------------------
# ALL JSON that enters the HMAC signing or verification pipeline MUST be
# produced with these exact parameters.  Using a named constant here — rather
# than repeating the literal kwargs at every call-site — means:
#
#   1. The canonical form is a single, auditable definition, not a convention
#      that could silently drift between pack and unpack.
#   2. Any future developer who wants to change serialisation (e.g. a
#      different encoder) has one obvious place to update and will naturally
#      see the HMAC implications in this comment.
#   3. The on-disk .bar bytes and the signed bytes are *identical* (minus the
#      hmac_signature field), making out-of-band verification trivially
#      reproducible with any standard JSON tool.
#
# NEVER add `indent=` to this dict — whitespace changes the byte sequence and
# would silently break HMAC verification on every file written before the
# change.
_CANONICAL_JSON_KWARGS: dict = {"sort_keys": True, "separators": (',', ':')}


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
        data: The data to sign (should be the entire BAR structure minus signature).
        key: The HMAC key — in practice the Fernet encryption key bytes.

    Returns:
        Hex-encoded HMAC-SHA256 signature string.

    Security:
        HMAC provides cryptographic proof that data hasn't been modified.
        Any change to the signed bytes produces a completely different digest
        (avalanche effect), making undetected tampering computationally
        infeasible.

    Note on API choice:
        ``digestmod`` is passed as a keyword argument (required since Python 3.8).
        Passing it positionally raised a DeprecationWarning from Python 3.4 and
        was tightened further in Python 3.13.  Using the keyword form is the
        documented, forward-compatible public API.
    """
    return hmac.new(key, data, digestmod=hashlib.sha256).hexdigest()


def verify_hmac_signature(data: bytes, key: bytes, signature: str) -> bool:
    """
    Verify HMAC-SHA256 signature to detect tampering.

    Args:
        data: The data to verify (canonical JSON bytes, identical to what was
              passed to :func:`generate_hmac_signature` at signing time).
        key: The HMAC key — must match the key used during signing.
        signature: The expected hex-encoded HMAC digest (from the BAR file).

    Returns:
        ``True`` if the signature is valid.

    Raises:
        TamperDetectedException: If the computed digest does not match
            ``signature``, indicating the file has been modified or corrupted.

    Security:
        Comparison is done with :func:`hmac.compare_digest` to prevent
        timing-based side-channel attacks.  The digest is recomputed fresh
        on every call; no cached values are used.

    Note on API choice:
        ``digestmod`` is passed as a keyword argument — see
        :func:`generate_hmac_signature` for rationale.
    """
    expected_signature = hmac.new(key, data, digestmod=hashlib.sha256).hexdigest()

    # Constant-time comparison prevents an attacker from inferring the correct
    # signature one byte at a time via response-time differences.
    if not hmac.compare_digest(expected_signature, signature):
        raise TamperDetectedException(
            "BAR file integrity check failed! File has been modified or corrupted. "
            "This could indicate tampering or data corruption."
        )

    return True


def delete_file(file_path: str) -> None:
    """
    Delete a file from the filesystem.

    Security model
    --------------
    BAR's data-at-rest protection comes entirely from **AES-256 encryption**
    (Fernet with PBKDF2-HMAC-SHA256 key derivation).  Once a .bar file is
    unlinked and its encryption key is gone, the ciphertext left on disk is
    cryptographically unrecoverable — the overwrite state of the underlying
    storage blocks is irrelevant.

    Multi-pass Gutmann/DoD-style overwrites (the previous implementation) are
    ineffective on every storage type BAR runs on in practice:

    * **SSDs with wear-leveling** — the OS writes go to fresh LBAs chosen by
      the FTL; the old physical cells are not touched by ``pwrite()``.
    * **Cloud block storage** (AWS EBS, Render, GCP PD) — the hypervisor maps
      virtual blocks to physical ones; a userspace write loop overwrites the
      VM's view, not the platter/NAND.
    * **Journaling filesystems** (ext4, NTFS) — the journal may retain a copy
      of pre-overwrite content regardless of how many times the data region
      is rewritten.

    The authoritative at-rest protection for server deployments is **full-disk
    encryption** offered by every major cloud provider (AWS EBS encryption,
    Render encrypted volumes, GCP CMEK).  Enable it at the infrastructure layer.
    For client-side .bar files the file itself is the encrypted artefact; the
    plaintext never touches the server disk.

    Args:
        file_path: Absolute or relative path to the file to delete.

    Raises:
        Exception: Re-raises any ``os.remove`` exception so callers can decide
                   whether a deletion failure is fatal or merely a warning.
    """
    try:
        os.remove(file_path)
    except FileNotFoundError:
        # Already gone (deleted by a concurrent request or cleanup cycle).
        # Treat as success — the goal (file is absent) is achieved.
        pass
    except Exception:
        # Re-raise so the caller can log / handle appropriately.
        # We do not silently swallow deletion failures; an undeleted file
        # is visible to the next cleanup cycle and will be retried.
        raise


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
        - If password is provided: Uses password-derived encryption (zero-knowledge).
          Only the salt is stored; the key must be re-derived from the password on
          every access.
        - If password is None: Stores key in file (backward compatible, less secure).

    HMAC canonical form
    -------------------
    The HMAC is computed over the compact JSON representation of the BAR structure
    **before** the ``hmac_signature`` field is added, using ``_CANONICAL_JSON_KWARGS``.
    The same compact representation is then stored on disk (after the signature is
    appended).  This means:

        signed_bytes == stored_json_bytes_minus_signature_field

    Any code that reconstructs the signed form for verification MUST use the same
    ``_CANONICAL_JSON_KWARGS`` — see :func:`unpack_bar_file`.

    Note:
        For password-protected files, prefer :func:`encrypt_and_pack_with_password`.
        This function is lower-level and requires you to manage salt/key derivation.
    """
    # Build the core BAR structure (without signature).
    bar_structure = {
        "metadata": metadata,
        "encrypted_data": base64.b64encode(encrypted_data).decode('utf-8'),
    }

    # Determine encryption method based on password.
    if password:
        # Password-derived encryption: store only the salt, NOT the key.
        # This is true zero-knowledge encryption — the key never touches disk.
        if salt is None:
            raise ValueError("Salt is required when password is provided")

        bar_structure["encryption_method"] = "password_derived"
        bar_structure["salt"] = base64.b64encode(salt).decode('utf-8')
    else:
        # Legacy mode: key stored directly in file (backward compatible).
        bar_structure["encryption_method"] = "key_stored"
        bar_structure["encryption_key"] = base64.b64encode(key).decode('utf-8')

    # --- HMAC signing ------------------------------------------------------ #
    # Produce the canonical JSON for the structure *before* adding the         #
    # signature field.  This is the byte sequence that will be signed and,     #
    # after the signature is appended, stored verbatim on disk.  Using the     #
    # named constant _CANONICAL_JSON_KWARGS ensures sign and verify always use #
    # exactly the same serialisation.                                          #
    # ----------------------------------------------------------------------- #
    canonical_json = json.dumps(bar_structure, **_CANONICAL_JSON_KWARGS)
    signature = generate_hmac_signature(canonical_json.encode('utf-8'), key)
    bar_structure["hmac_signature"] = signature

    # Serialise the final structure (with signature) using the SAME canonical
    # kwargs.  This guarantees that the bytes stored on disk can be audited
    # out-of-band: strip the hmac_signature key, re-sort, and the HMAC must
    # match.  Using a different serialisation here (e.g. indent=2) would create
    # an invisible divergence between the stored form and the canonical form.
    bar_json = json.dumps(bar_structure, **_CANONICAL_JSON_KWARGS)
    bar_bytes = bar_json.encode('utf-8')

    # Base64-encode the JSON to obfuscate it in text editors, then prepend the
    # fixed BAR file header.
    obfuscated_data = base64.b64encode(bar_bytes)
    header = b"BAR_FILE_V1\n"
    return header + obfuscated_data


def unpack_bar_file(bar_data: bytes, password: str = None) -> tuple:
    """
    Unpack BAR file into components.

    Args:
        bar_data: Raw BAR file data
        password: Optional password for password-derived encryption

    Returns:
        4-tuple of ``(encrypted_data, metadata, key, salt)`` where:

        * ``encrypted_data`` – the raw Fernet ciphertext as stored on disk.
          Callers that need to re-pack the file (e.g. after updating the view
          count) **must** reuse this blob verbatim so that the HMAC computed
          by :func:`pack_bar_file` matches on the next read.
        * ``metadata`` – the plaintext metadata dict.
        * ``key`` – the Fernet key (bytes, URL-safe base64 encoded).
        * ``salt`` – the PBKDF2 salt bytes for ``password_derived`` files, or
          ``None`` for ``key_stored`` (legacy) files.  Required by
          :func:`pack_bar_file` when re-packing a password-protected file.

    Security:
        - For password_derived files: Derives key from password and stored salt
        - For key_stored files: Extracts key from file (backward compatible)

    Raises:
        ValueError: If file format is invalid
        ValueError: If password is required but not provided
        TamperDetectedException: If the HMAC signature does not match
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

    salt: bytes | None = None  # Will be populated for password_derived files

    if encryption_method == "password_derived":
        # Password-derived encryption: Must derive key from password
        if not password:
            raise ValueError("Password required for decryption")

        # NOTE: password correctness is NOT pre-checked via a stored hash here.
        # A password_hash field may still exist in legacy .bar files — it is
        # intentionally ignored.  Password verification happens implicitly:
        #   1. PBKDF2-HMAC-SHA256 (100 000 iterations) derives the key.
        #   2. The HMAC signature over the entire BAR structure is verified.
        # A wrong password → wrong key → HMAC mismatch → TamperDetectedException.
        # Callers (EncryptionService.decrypt_bar_file) must catch that exception
        # and, when a password was supplied, re-raise it as HTTPException(403).

        # Get salt from file — kept so callers can re-pack without changing it
        salt = base64.b64decode(bar_structure["salt"])

        # Derive key from password and salt
        key = derive_key_from_password(password, salt)

    else:
        # Legacy mode: Key is stored in file
        key = base64.b64decode(bar_structure["encryption_key"])

    # --- HMAC verification ------------------------------------------------- #
    # Reconstruct the canonical JSON from the *parsed* structure with the      #
    # hmac_signature key removed, then re-serialise using _CANONICAL_JSON_KWARGS. #
    # This is intentionally symmetric with the signing step in pack_bar_file:  #
    # both sides independently produce the same byte sequence from the same    #
    # dict contents.  Raises TamperDetectedException on mismatch.              #
    # ----------------------------------------------------------------------- #
    if "hmac_signature" in bar_structure:
        stored_signature = bar_structure["hmac_signature"]

        structure_for_verification = {
            k: v for k, v in bar_structure.items() if k != "hmac_signature"
        }
        # MUST use _CANONICAL_JSON_KWARGS — identical to the kwargs used in
        # pack_bar_file during signing.  Any deviation here would cause every
        # valid file to fail verification.
        verification_json = json.dumps(structure_for_verification, **_CANONICAL_JSON_KWARGS)

        # Raises TamperDetectedException if signature does not match.
        verify_hmac_signature(verification_json.encode('utf-8'), key, stored_signature)
    else:
        # No signature present — old file format (pre-HMAC).
        # Allow for backward compatibility but warn the operator.
        import warnings
        warnings.warn(
            "BAR file does not contain an HMAC signature (pre-HMAC legacy format). "
            "File integrity cannot be verified — tampering cannot be detected. "
            "Re-encrypt the file with the current version to gain integrity protection.",
            UserWarning,
            stacklevel=2,  # Points the warning at the caller of unpack_bar_file,
                           # not at this internal utility, making it actionable
                           # in logs and -W error / pytest -W error environments.
        )

    return encrypted_data, metadata, key, salt


def peek_bar_metadata(bar_data: bytes) -> dict:
    """
    Extract the plaintext metadata header from a .bar file **without** performing
    key derivation, HMAC verification, or decryption.

    This is intentionally a *read-only, best-effort* function.  It is only used
    to retrieve ``webhook_url`` and ``filename`` for alerting purposes when full
    decryption is unavailable (e.g. wrong password, tamper event).  It raises
    ``ValueError`` on malformed input rather than swallowing it, but callers
    should always wrap it in a try/except.

    Args:
        bar_data: Raw .bar file bytes (may be password-protected or legacy).

    Returns:
        The ``metadata`` dict embedded in the BAR structure.

    Raises:
        ValueError: If the data is not a valid BAR file.
    """
    if not bar_data.startswith(b"BAR_FILE_V1\n"):
        raise ValueError("Invalid BAR file format")

    obfuscated_data = bar_data[12:]  # Strip the fixed header
    bar_json = base64.b64decode(obfuscated_data)
    bar_structure = json.loads(bar_json.decode("utf-8"))

    metadata = bar_structure.get("metadata")
    if metadata is None:
        raise ValueError("BAR file is missing metadata field")

    return metadata


# DEPRECATED: Use client_storage.validate_client_access() or server_storage.validate_server_access() instead
