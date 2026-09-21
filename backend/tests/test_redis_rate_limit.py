"""
Tests for Redis-backed sliding-window rate limiting and brute-force tracking.
"""
import time
from unittest.mock import MagicMock, patch
import pytest
from fastapi import HTTPException
from core import security


class FakeRedisPipeline:
    def __init__(self, fake_redis):
        self.fake_redis = fake_redis
        self.commands = []

    def zremrangebyscore(self, key, min_score, max_score):
        self.commands.append(("zremrangebyscore", key, min_score, max_score))
        return self

    def zcard(self, key):
        self.commands.append(("zcard", key))
        return self

    def zrange(self, key, start, stop, withscores=False):
        self.commands.append(("zrange", key, start, stop, withscores))
        return self

    def zadd(self, key, mapping):
        self.commands.append(("zadd", key, mapping))
        return self

    def expire(self, key, ttl):
        self.commands.append(("expire", key, ttl))
        return self

    def execute(self):
        results = []
        for cmd in self.commands:
            name = cmd[0]
            if name == "zremrangebyscore":
                _, key, min_val, max_val = cmd
                entries = self.fake_redis.zsets.get(key, {})
                max_score = float(max_val) if max_val != "+inf" else float("inf")
                min_score = float(min_val) if min_val != "-inf" else float("-inf")
                removed = [m for m, s in entries.items() if min_score <= s <= max_score]
                for m in removed:
                    del entries[m]
                results.append(len(removed))
            elif name == "zcard":
                _, key = cmd
                results.append(len(self.fake_redis.zsets.get(key, {})))
            elif name == "zrange":
                _, key, start, stop, withscores = cmd
                entries = sorted(self.fake_redis.zsets.get(key, {}).items(), key=lambda x: x[1])
                items = entries[start:stop + 1 if stop != -1 else None]
                if withscores:
                    results.append(items)
                else:
                    results.append([m for m, _ in items])
            elif name == "zadd":
                _, key, mapping = cmd
                if key not in self.fake_redis.zsets:
                    self.fake_redis.zsets[key] = {}
                for m, s in mapping.items():
                    self.fake_redis.zsets[key][m] = float(s)
                results.append(len(mapping))
            elif name == "expire":
                results.append(True)
        self.commands = []
        return results


class FakeRedisClient:
    """In-memory mock implementing Redis sorted set operations and Lua script evaluation."""
    def __init__(self):
        self.zsets = {}
        self.deleted_keys = []

    def pipeline(self):
        return FakeRedisPipeline(self)

    def delete(self, *keys):
        for k in keys:
            self.deleted_keys.append(k)
            self.zsets.pop(k, None)
        return len(keys)

    def eval(self, script, numkeys, key, now, window_start, limit, ttl, member):
        now = float(now)
        window_start = float(window_start)
        limit = int(limit)

        if key not in self.zsets:
            self.zsets[key] = {}

        # ZREMRANGEBYSCORE key -inf window_start
        to_del = [m for m, s in self.zsets[key].items() if s <= window_start]
        for m in to_del:
            del self.zsets[key][m]

        count = len(self.zsets[key])
        if count < limit:
            self.zsets[key][member] = now
            return [1, count + 1]
        else:
            return [0, count]


@pytest.fixture(autouse=True)
def cleanup_security_state():
    """Reset security module Redis client and in-memory storage around each test."""
    original_client = security._redis_client
    original_retry_time = security._last_redis_retry_time
    security.rate_limit_storage.clear()
    security.password_attempts.clear()
    yield
    security.set_redis_client(original_client)
    security._last_redis_retry_time = original_retry_time
    security.rate_limit_storage.clear()
    security.password_attempts.clear()


def test_redis_sliding_window_rate_limiting():
    """Verify check_rate_limit_keyed enforces limit and allows requests within window."""
    fake_redis = FakeRedisClient()
    security.set_redis_client(fake_redis)

    key = "test_user_ip"
    limit = 3

    # First 3 requests should pass
    security.check_rate_limit_keyed(key, limit=limit, window_seconds=60)
    security.check_rate_limit_keyed(key, limit=limit, window_seconds=60)
    security.check_rate_limit_keyed(key, limit=limit, window_seconds=60)

    # 4th request must raise HTTP 429
    with pytest.raises(HTTPException) as exc_info:
        security.check_rate_limit_keyed(key, limit=limit, window_seconds=60)
    assert exc_info.value.status_code == 429
    assert "Rate limit exceeded" in exc_info.value.detail


def test_redis_ws_rate_limiting():
    """Verify check_ws_rate_limit returns False when limit exceeded in Redis."""
    fake_redis = FakeRedisClient()
    security.set_redis_client(fake_redis)

    ip = "192.168.1.10"
    limit = 2

    assert security.check_ws_rate_limit(ip, limit=limit, window_seconds=60) is True
    assert security.check_ws_rate_limit(ip, limit=limit, window_seconds=60) is True
    assert security.check_ws_rate_limit(ip, limit=limit, window_seconds=60) is False


def test_redis_brute_force_lockout_and_success_reset():
    """Verify check_password_brute_force locks out on 5 failures and resets on success."""
    fake_redis = FakeRedisClient()
    security.set_redis_client(fake_redis)

    ip = "10.0.0.1"
    token = "test_token_123"

    # 4 failed attempts should not lock out
    for _ in range(4):
        security.record_password_attempt(ip, success=False, resource_id=token)
        is_locked, count, _ = security.check_password_brute_force(ip, resource_id=token)
        assert is_locked is False

    assert count == 4

    # 5th failed attempt locks out and raises 429
    security.record_password_attempt(ip, success=False, resource_id=token)
    with pytest.raises(HTTPException) as exc_info:
        security.check_password_brute_force(ip, resource_id=token)
    assert exc_info.value.status_code == 429
    assert "Account locked" in exc_info.value.detail

    # A successful attempt resets the lockout in Redis
    security.record_password_attempt(ip, success=True, resource_id=token)
    is_locked, count, _ = security.check_password_brute_force(ip, resource_id=token)
    assert is_locked is False
    assert count == 0


def test_redis_fallback_on_error():
    """Verify that when Redis fails, rate limiting and brute force fall back to in-memory store."""
    failing_redis = MagicMock()
    failing_redis.eval.side_effect = Exception("Redis connection refused")
    failing_redis.pipeline.side_effect = Exception("Redis timeout")
    security.set_redis_client(failing_redis)

    key = "fallback_ip"
    limit = 2

    # Should fall back to in-memory store and not crash
    security.check_rate_limit_keyed(key, limit=limit, window_seconds=60)
    security.check_rate_limit_keyed(key, limit=limit, window_seconds=60)

    # 3rd request reaches limit in memory store
    with pytest.raises(HTTPException) as exc_info:
        security.check_rate_limit_keyed(key, limit=limit, window_seconds=60)
    assert exc_info.value.status_code == 429


def test_close_redis_client():
    """Verify close_redis_client closes the client and resets _redis_client to None."""
    mock_client = MagicMock()
    security.set_redis_client(mock_client)
    assert security._redis_client is mock_client

    security.close_redis_client()
    assert security._redis_client is None
    mock_client.close.assert_called_once()


def test_redis_connection_retry_interval():
    """Verify get_redis_client respects retry interval on connection failures."""
    security.set_redis_client(None)
    security._last_redis_retry_time = 0.0

    with patch.object(security.settings, "redis_url", "redis://localhost:6379/0"):
        with patch("redis.from_url") as mock_from_url:
            mock_from_url.side_effect = Exception("Connection refused")

            # First attempt should fail and set _last_redis_retry_time
            client1 = security.get_redis_client()
            assert client1 is None
            assert security._last_redis_retry_time > 0

            # Immediate second attempt should return None without calling from_url again (cooldown)
            mock_from_url.reset_mock()
            client2 = security.get_redis_client()
            assert client2 is None
            mock_from_url.assert_not_called()

            # Fast forward past cooldown
            security._last_redis_retry_time = time.time() - 35.0
            client3 = security.get_redis_client()
            assert client3 is None
            mock_from_url.assert_called_once()

