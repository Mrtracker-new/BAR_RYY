"""
Crypto security, BarKey domain separation, and PBKDF2 iteration verification test suite.
"""

import inspect
import json
import base64
import pytest
from utils import crypto_utils


def test_pbkdf2_iteration_count():
    """Verify PBKDF2 iterations are configured to OWASP-recommended 600,000 rounds by default."""
    sig = inspect.signature(crypto_utils.derive_key_from_password)
    assert sig.parameters["iterations"].default == 600_000


def test_bar_key_domain_separation():
    """
    Verify BarKey derives distinct keys for Fernet symmetric encryption
    and HMAC-SHA256 integrity verification.
    """
    password = "SuperSecretPassword!2026"
    salt = b"\x01" * 32

    key = crypto_utils.derive_key_from_password(password, salt)

    # Key must be an instance of BarKey (subclassing bytes)
    assert isinstance(key, crypto_utils.BarKey)
    assert isinstance(key, bytes)

    # Fernet key (self) and hmac_key must be defined
    assert hasattr(key, "hmac_key")
    assert key.hmac_key is not None

    # Key material domain separation: Fernet key != HMAC key
    assert bytes(key) != key.hmac_key
    assert len(key.hmac_key) == 32  # Raw 32 bytes for HMAC-SHA256
    assert len(key) == 44  # Base64-encoded 32 bytes (44 chars) for Fernet


def test_bar_header_validation():
    """Verify unpack_bar_file and peek_bar_metadata reject data with corrupted or invalid headers."""
    payload = b"Sample confidential document"
    key = crypto_utils.generate_key()
    encrypted = crypto_utils.encrypt_file(payload, key)
    metadata = {"filename": "test.txt", "current_views": 0, "max_views": 1}

    bar_data = crypto_utils.pack_bar_file(encrypted, metadata, key)
    assert bar_data.startswith(crypto_utils._BAR_HEADER)

    # Corrupt header
    corrupted_bar = b"INVALID_HEADER\n" + bar_data[len(crypto_utils._BAR_HEADER) :]

    with pytest.raises(ValueError, match="Invalid BAR file format"):
        crypto_utils.unpack_bar_file(corrupted_bar)

    with pytest.raises(ValueError, match="Invalid BAR file format"):
        crypto_utils.peek_bar_metadata(corrupted_bar)


def test_tampered_hmac_signature_rejected():
    """Verify that tampering with the HMAC signature bytes causes verification failure."""
    payload = b"Protected data payload"
    password = "MySecurePassword123!"
    metadata = {"filename": "data.bin", "current_views": 0, "max_views": 2}

    bar_data, salt, key = crypto_utils.encrypt_and_pack_with_password(
        payload, metadata, password
    )

    # Decode JSON payload
    raw_b64 = bar_data[len(crypto_utils._BAR_HEADER) :]
    bar_dict = json.loads(base64.b64decode(raw_b64).decode("utf-8"))

    # Corrupt HMAC signature
    orig_sig = bar_dict["hmac_signature"]
    tampered_sig = "00" + orig_sig[2:] if not orig_sig.startswith("00") else "ff" + orig_sig[2:]
    bar_dict["hmac_signature"] = tampered_sig

    # Re-pack
    tampered_b64 = base64.b64encode(
        json.dumps(bar_dict, **crypto_utils._CANONICAL_JSON_KWARGS).encode("utf-8")
    )
    tampered_bar = crypto_utils._BAR_HEADER + tampered_b64

    with pytest.raises(crypto_utils.TamperDetectedException):
        crypto_utils.unpack_bar_file(tampered_bar, password=password)



def test_canonical_json_kwargs_contract():
    """Verify _CANONICAL_JSON_KWARGS contract enforces sort_keys and compact separators."""
    assert crypto_utils._CANONICAL_JSON_KWARGS["sort_keys"] is True
    assert crypto_utils._CANONICAL_JSON_KWARGS["separators"] == (",", ":")
