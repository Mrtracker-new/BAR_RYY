"""
Tests for 2FA OTP security:
- Cryptographically signed HMAC-SHA256 short-lived token generation and verification
- Multi-worker consistency
- Client IP binding and subject token binding
- OTP session burning (single-use guarantee)
- Elimination of global verification flag / race condition bypass
"""

import io
import time
from datetime import timedelta, datetime, timezone
import pytest
from fastapi.testclient import TestClient

from app import app
from core import security
from services.otp_service import OTPService, OTP_EXPIRY_MINUTES


@pytest.fixture(autouse=True)
def reset_rate_limits():
    """Clear rate-limiting dictionary before each test to prevent 429 throttling."""
    security.rate_limit_storage.clear()


@pytest.fixture
def client():
    """FastAPI TestClient instance configured with CSRF headers."""
    with TestClient(app, headers={"X-Requested-With": "XMLHttpRequest"}) as test_client:
        yield test_client


# ===========================================================================
# 1. Cryptographic Token Unit Tests
# ===========================================================================

def test_token_creation_and_verification_success():
    """A valid token is verified successfully and returns its claims."""
    token = "test-token-12345"
    client_ip = "192.0.2.1"

    signed_token = security.create_short_lived_token(
        data={"sub": token, "ip": client_ip},
        expires_delta=timedelta(minutes=5)
    )

    assert signed_token is not None
    assert "." in signed_token

    is_valid, payload, err = security.verify_short_lived_token(
        token=signed_token,
        expected_sub=token,
        expected_ip=client_ip
    )

    assert is_valid is True
    assert payload is not None
    assert payload["sub"] == token
    assert payload["ip"] == client_ip
    assert err == ""


def test_token_tampered_signature_rejected():
    """Any modification to the token payload or signature is rejected."""
    signed_token = security.create_short_lived_token(
        data={"sub": "token-1", "ip": "10.0.0.1"},
        expires_delta=timedelta(minutes=5)
    )

    payload_b64, sig_b64 = signed_token.split(".")
    # Tamper with signature
    tampered_sig = ("A" if sig_b64[0] != "A" else "B") + sig_b64[1:]
    tampered_token = f"{payload_b64}.{tampered_sig}"

    is_valid, payload, err = security.verify_short_lived_token(
        token=tampered_token,
        expected_sub="token-1",
        expected_ip="10.0.0.1"
    )
    assert is_valid is False
    assert payload is None
    assert "signature" in err.lower()


def test_token_expired_rejected():
    """Expired tokens are rejected."""
    signed_token = security.create_short_lived_token(
        data={"sub": "token-1", "ip": "10.0.0.1"},
        expires_delta=timedelta(seconds=-10)
    )

    is_valid, payload, err = security.verify_short_lived_token(
        token=signed_token,
        expected_sub="token-1",
        expected_ip="10.0.0.1"
    )
    assert is_valid is False
    assert payload is None
    assert "expired" in err.lower()


def test_token_subject_mismatch_rejected():
    """Tokens presented for a different file token are rejected."""
    signed_token = security.create_short_lived_token(
        data={"sub": "file-token-A", "ip": "10.0.0.1"},
        expires_delta=timedelta(minutes=5)
    )

    is_valid, payload, err = security.verify_short_lived_token(
        token=signed_token,
        expected_sub="file-token-B",
        expected_ip="10.0.0.1"
    )
    assert is_valid is False
    assert payload is None
    assert "subject" in err.lower()


def test_token_ip_mismatch_rejected():
    """Tokens presented from a different client IP are rejected (anti-hijack)."""
    signed_token = security.create_short_lived_token(
        data={"sub": "token-1", "ip": "198.51.100.42"},
        expires_delta=timedelta(minutes=5)
    )

    # Attacker tries using the token from a different IP
    is_valid, payload, err = security.verify_short_lived_token(
        token=signed_token,
        expected_sub="token-1",
        expected_ip="203.0.113.99"
    )
    assert is_valid is False
    assert payload is None
    assert "client ip" in err.lower()


def test_multi_worker_shared_secret_consistency():
    """Two separate workers sharing the same secret_key can issue and verify tokens."""
    shared_key = "test-shared-production-secret-key-32-chars-long"
    token_worker_1 = security.create_short_lived_token(
        data={"sub": "shared-file-token", "ip": "1.2.3.4"},
        expires_delta=timedelta(minutes=5),
        secret_key=shared_key
    )

    # Worker 2 verifies using the same shared_key
    is_valid, payload, err = security.verify_short_lived_token(
        token=token_worker_1,
        expected_sub="shared-file-token",
        expected_ip="1.2.3.4",
        secret_key=shared_key
    )
    assert is_valid is True
    assert payload["sub"] == "shared-file-token"


# ===========================================================================
# 2. OTPService Unit Tests
# ===========================================================================

def test_otp_service_single_use_burn():
    """Verifying an OTP burns the session immediately; subsequent attempts fail."""
    svc = OTPService()
    token = "test-burn-token"
    email = "alice@example.com"
    client_ip = "192.168.1.50"

    otp_code = svc.create_otp_session(token, email)

    # First verification succeeds and returns token
    valid, session_token, err = svc.verify_otp_and_issue_token(token, otp_code, client_ip)
    assert valid is True
    assert session_token is not None
    assert err == ""

    # Second attempt with same code fails because OTP session was burned
    valid_second, session_token_second, err_second = svc.verify_otp_and_issue_token(token, otp_code, client_ip)
    assert valid_second is False
    assert session_token_second is None
    assert "not found" in err_second.lower()


def test_otp_service_attempt_limits():
    """Exceeding max attempts locks out and removes the OTP session."""
    svc = OTPService()
    token = "test-attempts-token"
    email = "alice@example.com"
    client_ip = "192.168.1.50"

    svc.create_otp_session(token, email)

    # 1st wrong attempt
    v1, _, _ = svc.verify_otp_and_issue_token(token, "000000", client_ip)
    assert v1 is False

    # 2nd wrong attempt
    v2, _, _ = svc.verify_otp_and_issue_token(token, "000000", client_ip)
    assert v2 is False

    # 3rd wrong attempt -> locked out and deleted
    v3, _, err3 = svc.verify_otp_and_issue_token(token, "000000", client_ip)
    assert v3 is False
    assert "exceeded" in err3.lower()

    # Session is gone
    assert token not in svc.otp_storage


# ===========================================================================
# 3. Route Integration & Global Verification Bypass Prevention Tests
# ===========================================================================

def test_route_otp_verification_bypass_prevention(client, monkeypatch):
    """
    Test that verifying 2FA issues a token and prevents global fixation / bypass:
    1. Unverified access is blocked with 403.
    2. Legitimate user verifies OTP and receives otp_token.
    3. Attacker without token is STILL blocked with 403 (no global verified flag).
    4. Attacker with different IP is blocked with 403 (IP binding).
    5. Legitimate user with valid token accesses successfully.
    """
    file_content = b"Super sensitive 2FA protected document."
    file_name = "secret_report.txt"

    # 1. Upload
    up_res = client.post(
        "/upload",
        files={"file": (file_name, io.BytesIO(file_content), "text/plain")},
    )
    assert up_res.status_code == 200
    temp_filename = up_res.json()["temp_filename"]

    # 2. Seal with require_otp=True and max_views=5
    seal_res = client.post(
        "/seal",
        json={
            "temp_filename": temp_filename,
            "original_filename": file_name,
            "max_views": 5,
            "storage_mode": "server",
            "require_otp": True,
            "otp_emails": ["recipient@example.com"],
        },
    )
    assert seal_res.status_code == 200
    token = seal_res.json()["access_token"]

    # 3. Attempt access without OTP -> 403 Forbidden
    unverified_res = client.post(f"/share/{token}", json={})
    assert unverified_res.status_code == 403
    assert "2FA verification required" in unverified_res.json()["detail"]

    # 4. Request OTP
    from api.dependencies import get_otp_service_dep
    otp_svc = app.dependency_overrides.get(get_otp_service_dep, None)
    if otp_svc:
        otp_service_instance = otp_svc()
    else:
        from services.otp_service import get_otp_service
        otp_service_instance = get_otp_service()

    # Pre-generate OTP directly in service for testing
    otp_code = otp_service_instance.create_otp_session(token, "recipient@example.com")

    # 5. Legitimate user verifies OTP
    # TestClient default client host is 'testclient'
    verify_res = client.post(
        f"/verify-otp/{token}",
        data={"otp_code": otp_code}
    )
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["success"] is True
    assert "otp_token" in verify_data
    legit_otp_token = verify_data["otp_token"]

    # 6. ATTACK SCENARIO A: Attacker requests /share/{token} without any token
    # Under the old vulnerable code, self.otp_storage[token]["verified"] was True,
    # so the attacker would be granted access!
    # Under the new code, the attacker MUST be rejected with 403!
    attacker_no_token_res = client.post(f"/share/{token}", json={})
    assert attacker_no_token_res.status_code == 403
    assert "2FA verification required" in attacker_no_token_res.json()["detail"]

    # 7. ATTACK SCENARIO B: Attacker from another IP presents the victim's token
    # Mock client IP for attacker
    from services import analytics
    monkeypatch.setattr(analytics, "get_client_ip", lambda req: "198.51.100.99")

    attacker_with_token_res = client.post(
        f"/share/{token}",
        json={"otp_token": legit_otp_token}
    )
    assert attacker_with_token_res.status_code == 403
    assert "2FA verification failed" in attacker_with_token_res.json()["detail"]

    # 8. LEGITIMATE USER SCENARIO: User with matching IP presents their token
    # Restore original client IP resolution (or set to match testclient)
    monkeypatch.setattr(analytics, "get_client_ip", lambda req: "testclient")

    # Test via request body
    legit_res = client.post(
        f"/share/{token}",
        json={"otp_token": legit_otp_token}
    )
    assert legit_res.status_code == 200
    assert legit_res.content == file_content

    # Test via X-OTP-Token header
    legit_header_res = client.post(
        f"/share/{token}",
        json={},
        headers={"X-OTP-Token": legit_otp_token}
    )
    assert legit_header_res.status_code == 200
    assert legit_header_res.content == file_content
