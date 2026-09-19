"""
Crypto and BAR file tamper detection test suite.
"""

import json
import base64
import pytest
from utils import crypto_utils


@pytest.mark.parametrize(
    "payload",
    [
        b"",
        b"a",
        b"A" * 128,
        b"B" * 4096,
        b"C" * (1024 * 1024),
    ],
    ids=["empty", "1byte", "128bytes", "4KB", "1MB"],
)
def test_fernet_encryption_roundtrip(payload):
    """Verify Fernet encryption and decryption round-trip for varying payload sizes."""
    key = crypto_utils.generate_key()
    encrypted = crypto_utils.encrypt_file(payload, key)
    decrypted = crypto_utils.decrypt_file(encrypted, key)
    assert decrypted == payload


def test_pbkdf2_key_derivation_deterministic():
    """Verify PBKDF2 key derivation is deterministic for fixed password and salt."""
    password = "CorrectHorseBatteryStaple123!"
    salt = b"0" * 32
    key1 = crypto_utils.derive_key_from_password(password, salt)
    key2 = crypto_utils.derive_key_from_password(password, salt)
    assert key1 == key2
    assert len(key1) == 44  # Base64-encoded 32-byte key


def test_pack_unpack_password_derived():
    """Verify end-to-end packing and unpacking for password-derived BAR files."""
    file_data = b"Secret text content for BAR file test."
    metadata = {
        "filename": "secret.txt",
        "created_at": "2026-07-28T00:00:00Z",
        "expires_at": "2026-07-29T00:00:00Z",
        "max_views": 5,
        "current_views": 0,
        "storage_mode": "client",
    }
    password = "MySecurePassword456!"

    bar_data, salt, key = crypto_utils.encrypt_and_pack_with_password(
        file_data, metadata, password
    )
    assert bar_data.startswith(crypto_utils._BAR_HEADER)

    # Unpack with correct password
    enc_data_out, meta_out, key_out, salt_out = crypto_utils.unpack_bar_file(
        bar_data, password=password
    )
    decrypted_file = crypto_utils.decrypt_file(enc_data_out, key_out)

    assert decrypted_file == file_data
    assert meta_out["filename"] == "secret.txt"
    assert salt_out == salt


def test_unpack_wrong_password_raises_exception():
    """Verify unpacking with an incorrect password fails and yields no plaintext."""
    file_data = b"Confidential financial statement."
    metadata = {"filename": "finance.pdf", "current_views": 0}
    password = "RightPassword123!"

    bar_data, _, _ = crypto_utils.encrypt_and_pack_with_password(
        file_data, metadata, password
    )

    # Attempt unpack with wrong password
    with pytest.raises((ValueError, crypto_utils.TamperDetectedException)):
        crypto_utils.unpack_bar_file(bar_data, password="WrongPassword999!")


@pytest.mark.parametrize(
    "tamper_field,tamper_value",
    [
        ("expires_at", "2099-01-01T00:00:00Z"),
        ("filename", "malicious.exe"),
        ("max_views", 99999),
        ("current_views", 0),
        ("storage_mode", "server"),
    ],
)
def test_independent_metadata_field_tamper_detection(tamper_field, tamper_value):
    """Verify that tampering with any single metadata field independently triggers HMAC failure."""
    file_data = b"Sample sensitive data."
    metadata = {
        "filename": "test.txt",
        "created_at": "2026-07-28T00:00:00Z",
        "expires_at": "2026-07-28T01:00:00Z",
        "max_views": 1,
        "current_views": 1,
        "storage_mode": "client",
    }
    password = "TamperTestPassword789!"

    bar_data, _, key = crypto_utils.encrypt_and_pack_with_password(
        file_data, metadata, password
    )

    # Manually unpack raw JSON payload without verifying
    encoded_payload = bar_data[len(crypto_utils._BAR_HEADER) :]
    bar_struct = json.loads(base64.b64decode(encoded_payload).decode("utf-8"))

    # Tamper with target metadata field
    bar_struct["metadata"][tamper_field] = tamper_value

    # Re-serialize canonical JSON and re-wrap in _BAR_HEADER
    tampered_json = json.dumps(bar_struct, **crypto_utils._CANONICAL_JSON_KWARGS)
    tampered_bar_bytes = crypto_utils._BAR_HEADER + base64.b64encode(
        tampered_json.encode("utf-8")
    )

    # Unpacking tampered BAR file must raise TamperDetectedException
    with pytest.raises(crypto_utils.TamperDetectedException):
        crypto_utils.unpack_bar_file(tampered_bar_bytes, password=password)


def test_update_bar_view_count_happy_path_and_tamper():
    """Verify update_bar_view_count increments counter on valid files and rejects tampered files."""
    file_data = b"View count test payload."
    metadata = {"filename": "doc.pdf", "current_views": 1, "max_views": 5}
    key = crypto_utils.generate_key()

    encrypted_data = crypto_utils.encrypt_file(file_data, key)
    bar_data = crypto_utils.pack_bar_file(encrypted_data, metadata, key)

    # Update view count
    updated_bar = crypto_utils.update_bar_view_count(bar_data, key)

    # Verify increment
    _, updated_meta, _, _ = crypto_utils.unpack_bar_file(updated_bar)
    assert updated_meta["current_views"] == 2

    # Tamper with updated_bar bytes
    encoded_payload = updated_bar[len(crypto_utils._BAR_HEADER) :]
    bar_struct = json.loads(base64.b64decode(encoded_payload).decode("utf-8"))
    bar_struct["metadata"]["current_views"] = 0
    tampered_json = json.dumps(bar_struct, **crypto_utils._CANONICAL_JSON_KWARGS)
    tampered_bytes = crypto_utils._BAR_HEADER + base64.b64encode(
        tampered_json.encode("utf-8")
    )

    with pytest.raises(crypto_utils.TamperDetectedException):
        crypto_utils.update_bar_view_count(tampered_bytes, key)
