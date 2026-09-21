"""
Unit and integration tests for Redis-backed OTP horizontal scaling across worker processes.
"""
import json
import time
from unittest.mock import MagicMock
from datetime import datetime, timedelta, timezone
import pytest
from services.otp_service import OTPService, MAX_OTP_ATTEMPTS, OTP_EXPIRY_MINUTES


class FakeRedisForOTP:
    """In-memory mock for Redis key-value and TTL operations used by OTPService."""

    def __init__(self):
        self.store = {}
        self.ttls = {}

    def set(self, key: str, value: str, ex: int = None):
        self.store[key] = value
        if ex:
            self.ttls[key] = time.time() + ex
        return True

    def get(self, key: str):
        if key not in self.store:
            return None
        if key in self.ttls and time.time() > self.ttls[key]:
            del self.store[key]
            del self.ttls[key]
            return None
        return self.store[key]

    def delete(self, *keys: str):
        for k in keys:
            self.store.pop(k, None)
            self.ttls.pop(k, None)
        return len(keys)

    def ttl(self, key: str):
        if key not in self.store:
            return -2
        if key in self.ttls:
            remaining = int(self.ttls[key] - time.time())
            return max(0, remaining)
        return -1

    def incr(self, key: str):
        val = int(self.store.get(key, 0)) + 1
        self.store[key] = str(val)
        return val

    def expire(self, key: str, seconds: int):
        self.ttls[key] = time.time() + seconds
        return True


def test_otp_created_on_worker_1_verified_on_worker_2():
    """Verify that an OTP created on Worker 1 can be verified on Worker 2 via shared Redis."""
    shared_redis = FakeRedisForOTP()

    worker_1_otp_svc = OTPService()
    worker_1_otp_svc.set_redis_client(shared_redis)

    worker_2_otp_svc = OTPService()
    worker_2_otp_svc.set_redis_client(shared_redis)

    token = "test-token-12345"
    email = "user@example.com"

    # Worker 1 generates OTP
    otp_code = worker_1_otp_svc.create_otp_session(token, email)
    assert f"otp:session:{token}" in shared_redis.store
    assert shared_redis.ttl(f"otp:session:{token}") > 0

    # Worker 2 does NOT have the token in its local memory
    assert token not in worker_2_otp_svc.otp_storage

    # Worker 2 verifies the OTP using Redis state
    valid, session_token, err = worker_2_otp_svc.verify_otp_and_issue_token(
        token, otp_code, client_ip="192.168.1.50"
    )
    assert valid is True
    assert session_token is not None
    assert err == ""

    # Single-use: OTP must now be burned from Redis
    assert shared_redis.get(f"otp:session:{token}") is None

    # Replay on Worker 1 or Worker 2 must fail
    replay_valid, _, replay_err = worker_1_otp_svc.verify_otp_and_issue_token(
        token, otp_code, client_ip="192.168.1.50"
    )
    assert replay_valid is False
    assert "not found" in replay_err.lower()


def test_otp_attempt_limits_shared_across_workers():
    """Verify that failed OTP attempts on Worker 1 count towards lockout on Worker 2."""
    shared_redis = FakeRedisForOTP()

    worker_1_otp_svc = OTPService()
    worker_1_otp_svc.set_redis_client(shared_redis)

    worker_2_otp_svc = OTPService()
    worker_2_otp_svc.set_redis_client(shared_redis)

    token = "test-token-limits"
    email = "user@example.com"

    # Worker 1 generates OTP
    otp_code = worker_1_otp_svc.create_otp_session(token, email)

    # Worker 1 receives 2 invalid attempts
    for _ in range(2):
        valid, _, err = worker_1_otp_svc.verify_otp_and_issue_token(
            token, "000000", client_ip="192.168.1.50"
        )
        assert valid is False
        assert "Invalid OTP code" in err

    # Worker 2 receives the 3rd (final) invalid attempt
    valid, _, err = worker_2_otp_svc.verify_otp_and_issue_token(
        token, "000000", client_ip="192.168.1.50"
    )
    assert valid is False
    assert "Maximum OTP attempts" in err

    # Session must be burned
    assert shared_redis.get(f"otp:session:{token}") is None


def test_otp_redis_fallback_on_error():
    """Verify that when Redis fails, OTP operations fall back to local in-memory store."""
    failing_redis = MagicMock()
    failing_redis.set.side_effect = Exception("Redis connection lost")
    failing_redis.get.side_effect = Exception("Redis connection lost")

    otp_svc = OTPService()
    otp_svc.set_redis_client(failing_redis)

    token = "test-fallback-token"
    otp_code = otp_svc.create_otp_session(token, "test@example.com")
    assert token in otp_svc.otp_storage

    valid, session_token, err = otp_svc.verify_otp_and_issue_token(
        token, otp_code, client_ip="127.0.0.1"
    )
    assert valid is True
    assert session_token is not None
