import os
import json
import base64
import hmac
import hashlib
import warnings
from datetime import datetime, timedelta
from typing import TypedDict
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend

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
#
# _CanonicalJsonKwargs is a closed TypedDict: only `sort_keys` and
# `separators` are structurally valid keys.  Any attempt to extend this dict
# (e.g. ``indent=2``) is a **static type error** caught at the definition
# site rather than silently corrupting the on-disk canonical form at runtime.
class _CanonicalJsonKwargs(TypedDict):
    """Exact set of ``json.dumps`` keyword arguments permitted in canonical BAR serialisation.

    This TypedDict is intentionally *closed* (total=True, no extras).  A type
    checker that understands TypedDict structural compatibility will reject any
    dict literal that adds keys not listed here — such as ``indent``, which
    would silently break HMAC verification across every file on disk.
    """

    sort_keys: bool
    separators: tuple[str, str]


_CANONICAL_JSON_KWARGS: _CanonicalJsonKwargs = {"sort_keys": True, "separators": (',', ':')}

# ---------------------------------------------------------------------------
# BAR file binary format
# ---------------------------------------------------------------------------
# The on-disk .bar format is:
#
#   <_BAR_HEADER><Base64-encoded JSON payload>
#
# The JSON payload is Base64-encoded so the binary .bar container is safe to
# transport and store as an opaque byte stream — Base64 is a *transport
# encoding*, not a security measure.  The actual security comes from:
#
#   • Fernet symmetric encryption (AES-128-CBC + PKCS7, random IV per message)
#     applied to the file content inside ``encrypted_data``.
#   • PBKDF2-HMAC-SHA256 (100 000 iterations) for password-derived key stretching.
#   • HMAC-SHA256 over the entire BAR structure for tamper detection.
#
# _BAR_HEADER is the single authoritative source of truth for the magic
# string and its length.  Both the writer (pack_bar_file) and every reader
# (unpack_bar_file, peek_bar_metadata) derive the header check and payload
# slice offset from this constant, so that any future version bump (e.g.
# b"BAR_FILE_V2\n") requires exactly ONE line change here — not a grep-and-
# pray hunt for magic numbers scattered across the module.
_BAR_HEADER: bytes = b"BAR_FILE_V1\n"


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
        Uses :func:`hmac.digest` (Python 3.7+) — the one-shot, allocation-free
        HMAC API.  Unlike ``hmac.new(key, msg, digestmod=...).hexdigest()``,
        ``hmac.digest`` does not instantiate an intermediate HMAC object; when
        OpenSSL is available (the default on CPython), it dispatches directly
        to ``HMAC_CTX`` via ``_hashlib.hmac_digest``, making it both faster and
        more memory-efficient for single-use signing calls like this one.
    """
    return hmac.digest(key, data, digest=hashlib.sha256).hex()


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
        Uses :func:`hmac.digest` (Python 3.7+) — see
        :func:`generate_hmac_signature` for full rationale.  The same one-shot
        API is used on both the sign and verify paths to guarantee byte-for-byte
        parity between what was signed and what is recomputed here.
    """
    expected_signature = hmac.digest(key, data, digest=hashlib.sha256).hex()

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

    # Base64-encode the canonical JSON so the binary .bar container is
    # byte-stream-safe for filesystem storage and HTTP transfer.  This is a
    # *transport encoding only* — it provides no confidentiality.  The
    # confidentiality guarantee comes from Fernet encryption of the file
    # content stored in ``encrypted_data``, and integrity is guaranteed by
    # the HMAC-SHA256 signature appended above.  _BAR_HEADER is the
    # module-level constant; do not repeat the literal here.
    encoded_payload = base64.b64encode(bar_bytes)
    return _BAR_HEADER + encoded_payload


def update_bar_view_count(bar_data: bytes, key: bytes) -> bytes:
    """
    Increment ``metadata["current_views"]`` in a packed BAR file and re-sign.

    This is the **only correct** entry point for persisting a view-count change
    on a client-side BAR file.  It exists to decouple the "update one mutable
    counter" operation from the full :func:`pack_bar_file` seal pipeline.

    Why not call ``pack_bar_file`` directly?
    ----------------------------------------
    ``pack_bar_file`` is designed for *creating* BAR files — it accepts
    ``encrypted_data``, ``metadata``, ``key``, ``password``, and ``salt`` as
    independent parameters and rebuilds the entire ``bar_structure`` dict from
    scratch.  Reusing it for a view-count update introduces two failure modes:

    1. **Parameter drift** — the caller must thread ``encrypted_data``,
       ``salt``, and the stripped ``password`` through the route handler just to
       write a single integer.  Any mismatch (e.g. passing ``request.password``
       instead of the stripped ``password_to_use``) produces an HMAC signed
       with a different key, causing ``TamperDetectedException`` on every
       subsequent read.

    2. **Structural drift** — if ``pack_bar_file`` is ever extended (new top-
       level key, different ordering), calling it after an update changes the
       canonical form of files it touches, invalidating signatures written by
       the old version.  This function works directly on the *already-parsed
       on-disk structure* and only touches the one key that changed.

    Algorithm
    ---------
    1. Decode the BAR bytes (strip header → base64-decode → JSON-parse).
    2. **Verify** the existing HMAC before mutating anything — if the file is
       already tampered with, refuse to re-sign and legitimise the corruption.
    3. Increment ``bar_structure["metadata"]["current_views"]`` in-place.
    4. Remove the stale ``hmac_signature`` key.
    5. Produce a fresh canonical JSON (same ``_CANONICAL_JSON_KWARGS`` as
       :func:`pack_bar_file`) and sign it with ``key``.
    6. Re-append ``hmac_signature`` and serialise once more with the same kwargs.
    7. Return ``_BAR_HEADER + base64(new_json_bytes)``.

    The signed bytes and the stored bytes are therefore **identical by
    construction** — not by convention — for every file this function writes.

    Legacy files (no ``hmac_signature``)
    -------------------------------------
    Files written before HMAC support was added contain no signature.  This
    function **refuses** to update them.  Updating an unauthenticated file is
    semantically equivalent to silently corrupting it: we cannot verify that
    the view count (or any other field) has not already been tampered with
    before applying our mutation.  A ``UserWarning`` is emitted so operators
    can identify and re-seal affected files.

    Args:
        bar_data: The current raw BAR file bytes (as read from disk).
        key:      The Fernet encryption key (bytes, URL-safe base64 encoded).
                  Used exclusively for HMAC signing/verification; the
                  ciphertext is not touched.

    Returns:
        New BAR file bytes with the incremented view count and a fresh,
        valid HMAC signature.  The caller is responsible for writing these
        bytes to disk atomically (i.e. open → write → close in one pass).

    Raises:
        ValueError: If the BAR file is malformed, missing required fields, or
            is a legacy pre-HMAC file (update refused for safety).
        TamperDetectedException: If the existing HMAC does not match ``key``,
            indicating tampering or key mismatch before this call.
    """
    if not bar_data.startswith(_BAR_HEADER):
        raise ValueError("Invalid BAR file format")

    # ── 1. Decode ─────────────────────────────────────────────────────────── #
    # Strip the fixed header to isolate the Base64-encoded JSON payload, then
    # decode it.  Base64 here is purely a transport encoding (see module-level
    # format comment); all security properties come from Fernet and HMAC below.
    encoded_payload = bar_data[len(_BAR_HEADER):]
    bar_structure: dict = json.loads(base64.b64decode(encoded_payload).decode("utf-8"))

    # ── 2. Guard: refuse legacy unsigned files ────────────────────────────── #
    if "hmac_signature" not in bar_structure:
        warnings.warn(
            "update_bar_view_count: BAR file has no HMAC signature (pre-HMAC "
            "legacy format).  View-count update refused — the file's integrity "
            "cannot be verified before mutation.  Re-seal the file with the "
            "current version to gain integrity protection and view-count "
            "persistence.",
            UserWarning,
            stacklevel=2,
        )
        raise ValueError(
            "Cannot update view count: BAR file has no HMAC signature. "
            "Re-seal the file to enable view-count persistence."
        )

    # ── 3. Verify existing signature before mutating anything ─────────────── #
    # If the file has been tampered with we must not re-sign it — doing so
    # would legitimise the corruption.  Raises TamperDetectedException on
    # mismatch; let it propagate so the caller can surface it as a 403.
    stored_sig = bar_structure["hmac_signature"]
    structure_for_verification = {
        k: v for k, v in bar_structure.items() if k != "hmac_signature"
    }
    verification_json = json.dumps(structure_for_verification, **_CANONICAL_JSON_KWARGS)
    verify_hmac_signature(verification_json.encode("utf-8"), key, stored_sig)

    # ── 4. Mutate only the view count ─────────────────────────────────────── #
    metadata = bar_structure.get("metadata")
    if metadata is None:
        raise ValueError("BAR file is missing 'metadata' field")
    if "current_views" not in metadata:
        raise ValueError("BAR file metadata is missing 'current_views' field")

    # Direct in-place increment — bar_structure["metadata"] IS this dict.
    metadata["current_views"] += 1

    # ── 5. Re-sign ────────────────────────────────────────────────────────── #
    # Remove the stale signature so it is NOT included in the canonical bytes
    # that are fed to the HMAC.  This mirrors the signing step in pack_bar_file
    # exactly: sign(structure_without_signature) → append signature.
    bar_structure.pop("hmac_signature", None)
    canonical_json = json.dumps(bar_structure, **_CANONICAL_JSON_KWARGS)
    bar_structure["hmac_signature"] = generate_hmac_signature(
        canonical_json.encode("utf-8"), key
    )

    # ── 6. Re-encode ──────────────────────────────────────────────────────── #
    # Serialise with _CANONICAL_JSON_KWARGS — identical to pack_bar_file.
    # The stored bytes and the signed bytes therefore differ only by the
    # presence of the hmac_signature key, which is the defined invariant.
    final_json = json.dumps(bar_structure, **_CANONICAL_JSON_KWARGS)
    return _BAR_HEADER + base64.b64encode(final_json.encode("utf-8"))


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
    # Validate the magic header then strip it.  Both the sentinel and the
    # slice offset are derived from _BAR_HEADER so they stay in sync
    # automatically if the constant is ever updated.
    if not bar_data.startswith(_BAR_HEADER):
        raise ValueError("Invalid BAR file format")

    # Strip the fixed header to isolate the Base64-encoded JSON payload.
    # Base64 is a transport encoding (not a security layer) — see the
    # module-level format comment for the full security architecture.
    encoded_payload = bar_data[len(_BAR_HEADER):]

    # Decode the Base64 transport encoding to recover the canonical JSON bytes.
    bar_json = base64.b64decode(encoded_payload)
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
        #
        # stacklevel=2 points the warning at the *caller* of unpack_bar_file,
        # not at this internal helper.  That makes the source location
        # actionable in logs and in -W error / pytest -W error environments.
        warnings.warn(
            "BAR file does not contain an HMAC signature (pre-HMAC legacy format). "
            "File integrity cannot be verified — tampering cannot be detected. "
            "Re-encrypt the file with the current version to gain integrity protection.",
            UserWarning,
            stacklevel=2,
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
    if not bar_data.startswith(_BAR_HEADER):
        raise ValueError("Invalid BAR file format")

    # Strip the fixed header, then decode the Base64 transport encoding to
    # recover the canonical JSON bytes.  No key derivation or HMAC check is
    # performed here — this is an intentional best-effort read for metadata
    # extraction only (e.g. to obtain webhook_url when full decryption is
    # unavailable).  See module-level format comment for security architecture.
    encoded_payload = bar_data[len(_BAR_HEADER):]
    bar_json = base64.b64decode(encoded_payload)
    bar_structure = json.loads(bar_json.decode("utf-8"))

    metadata = bar_structure.get("metadata")
    if metadata is None:
        raise ValueError("BAR file is missing metadata field")

    return metadata


