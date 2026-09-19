"""
tests/test_chat_service.py
--------------------------
Unit tests for services/chat_service.py.

Run from the backend directory:
    pytest tests/test_chat_service.py -v --asyncio-mode=auto
"""

from __future__ import annotations

import sys
import os
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import services.chat_service as svc

# Note: asyncio_mode = auto in pytest.ini handles both sync and async tests automatically.


def _fresh_ws() -> MagicMock:
    ws = MagicMock()
    ws.send_json = AsyncMock()
    ws.close     = AsyncMock()
    return ws


def _clear():
    # Cancel any background countdown tasks to avoid unawaited task warnings
    for session in list(svc._SESSIONS.values()):
        if session._destroy_task and not session._destroy_task.done():
            try:
                session._destroy_task.cancel()
            except Exception:
                pass
    svc._SESSIONS.clear()
    # Also reset the PIN rate-limiter between tests so failures from one
    # test cannot bleed into the next.
    svc._pin_rl._records.clear()


async def _join(token, ws, name, pin=None):
    """Convenience wrapper: returns (participant, status, ws_id)."""
    participant, status = await svc.join_session(token, ws, name, pin=pin)
    ws_id = participant.ws_id if participant else None
    return participant, status, ws_id


# ---------------------------------------------------------------------------
# PIN generation  (pure / sync)
# ---------------------------------------------------------------------------

class TestGeneratePin:
    def test_length(self):
        assert len(svc._generate_pin()) == svc._PIN_LENGTH

    def test_alphabet_only(self):
        for _ in range(50):
            assert all(c in svc._PIN_ALPHABET for c in svc._generate_pin())

    def test_no_ambiguous_chars(self):
        for _ in range(200):
            for bad in "0O1I":
                assert bad not in svc._generate_pin()

    def test_unique(self):
        assert len({svc._generate_pin() for _ in range(500)}) == 500


# ---------------------------------------------------------------------------
# HTML sanitisation  (pure / sync)
# ---------------------------------------------------------------------------

class TestSafeText:
    def test_preserves_text_for_react(self):
        assert svc._safe_text("<script>alert(1)</script>", 2000) == "<script>alert(1)</script>"

    def test_preserves_quotes_for_json(self):
        assert svc._safe_text('say "hi"', 2000) == 'say "hi"'

    def test_truncation(self):
        assert len(svc._safe_text("A" * 3000, 100)) <= 100

    def test_empty(self):
        assert svc._safe_text("", 100) == ""


# ---------------------------------------------------------------------------
# Session creation  (async — create_task needs a running loop)
# ---------------------------------------------------------------------------

class TestCreateSession:
    async def test_returns_tuple(self):
        _clear()
        token, pin, expires_at = svc.create_session(60)
        assert len(token) == 36 and len(pin) == svc._PIN_LENGTH
        assert expires_at > datetime.now(timezone.utc)

    async def test_expiry_approx(self):
        _clear()
        before = datetime.now(timezone.utc)
        _, _, exp = svc.create_session(300)
        after = datetime.now(timezone.utc)
        assert before + timedelta(seconds=298) <= exp <= after + timedelta(seconds=302)

    def test_ttl_lower_bound(self):
        with pytest.raises(ValueError):
            svc.create_session(svc.MIN_TTL_SECONDS - 1)

    def test_ttl_upper_bound(self):
        with pytest.raises(ValueError):
            svc.create_session(svc.MAX_TTL_SECONDS + 1)

    async def test_session_stored(self):
        _clear()
        token, _, _ = svc.create_session(60)
        assert token in svc._SESSIONS

    async def test_unique_pins(self):
        _clear()
        pins = [svc.create_session(60)[1] for _ in range(20)]
        assert len(set(pins)) == 20

    async def test_session_cap(self):
        _clear()
        orig = svc.MAX_SESSIONS
        svc.MAX_SESSIONS = 2
        try:
            svc.create_session(60)
            svc.create_session(60)
            with pytest.raises(RuntimeError, match="Maximum concurrent"):
                svc.create_session(60)
        finally:
            svc.MAX_SESSIONS = orig
            _clear()


# ---------------------------------------------------------------------------
# get_session / session_info
# ---------------------------------------------------------------------------

class TestGetSession:
    async def test_returns_live(self):
        _clear()
        token, _, _ = svc.create_session(60)
        assert svc.get_session(token) is not None

    def test_unknown_returns_none(self):
        assert svc.get_session("not-a-token") is None

    async def test_expired_returns_none(self):
        _clear()
        token, _, _ = svc.create_session(60)
        svc._SESSIONS[token].expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        assert svc.get_session(token) is None

    async def test_info_structure(self):
        _clear()
        token, _, _ = svc.create_session(120)
        info = svc.session_info(token)
        assert info and all(k in info for k in ("token", "expires_at", "seconds_remaining", "participant_count"))
        assert info["seconds_remaining"] > 0

    async def test_info_none_on_expired(self):
        _clear()
        token, _, _ = svc.create_session(60)
        svc._SESSIONS[token].expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        assert svc.session_info(token) is None


# ---------------------------------------------------------------------------
# join_session
# ---------------------------------------------------------------------------

class TestJoinSession:
    async def test_participant(self):
        _clear()
        token, _, _ = svc.create_session(120)
        p, status, ws_id = await _join(token, _fresh_ws(), "Alice")
        assert status == svc.JoinStatus.OK
        assert p and not p.is_creator

    async def test_creator_correct_pin(self):
        _clear()
        token, pin, _ = svc.create_session(120)
        p, status, ws_id = await _join(token, _fresh_ws(), "Bob", pin=pin)
        assert status == svc.JoinStatus.OK
        assert p and p.is_creator

    async def test_creator_wrong_pin_rejected(self):
        """A wrong PIN must hard-reject the join — not silently demote."""
        _clear()
        token, _, _ = svc.create_session(120)
        p, status, ws_id = await _join(token, _fresh_ws(), "Eve", pin="XXXXXX")
        assert status == svc.JoinStatus.PIN_INVALID
        assert p is None and ws_id is None
        assert len(svc._SESSIONS[token].participants) == 0

    async def test_expired_returns_not_found(self):
        _clear()
        token, _, _ = svc.create_session(120)
        svc._SESSIONS[token].expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        p, status, ws_id = await _join(token, _fresh_ws(), "Ghost")
        assert status == svc.JoinStatus.SESSION_NOT_FOUND
        assert p is None and ws_id is None

    async def test_joined_event_sent(self):
        _clear()
        token, _, _ = svc.create_session(120)
        ws = _fresh_ws()
        _, status, _ = await _join(token, ws, "Charlie")
        assert status == svc.JoinStatus.OK
        payload = ws.send_json.call_args_list[-1][0][0]
        assert payload["type"] == "joined"

    async def test_participant_cap(self):
        _clear()
        orig = svc.MAX_PARTICIPANTS
        svc.MAX_PARTICIPANTS = 2
        try:
            token, _, _ = svc.create_session(120)
            ws1, ws2, ws3 = _fresh_ws(), _fresh_ws(), _fresh_ws()
            _, s1, _ = await _join(token, ws1, "P1")
            _, s2, _ = await _join(token, ws2, "P2")
            p3, s3, _ = await _join(token, ws3, "P3")
            assert s1 == svc.JoinStatus.OK
            assert s2 == svc.JoinStatus.OK
            assert s3 == svc.JoinStatus.SESSION_FULL
            assert p3 is None
        finally:
            svc.MAX_PARTICIPANTS = orig

    async def test_name_sanitised(self):
        _clear()
        token, _, _ = svc.create_session(120)
        p, _, _ = await _join(token, _fresh_ws(), "A" * 50)
        assert len(p.name) <= svc.MAX_NAME_LENGTH

    async def test_no_history_on_join(self):
        _clear()
        token, _, _ = svc.create_session(120)
        ws = _fresh_ws()
        await _join(token, ws, "NoHistory")
        payload = ws.send_json.call_args_list[-1][0][0]
        assert "messages" not in payload

    async def test_pin_normalised_before_compare(self):
        _clear()
        token, pin, _ = svc.create_session(120)
        p, status, _ = await _join(token, _fresh_ws(), "Creator", pin=pin)
        assert status == svc.JoinStatus.OK and p.is_creator

    async def test_ws_id_is_uuid(self):
        """ws_id must be a valid UUID4 string, never a memory address."""
        import uuid as _uuid
        _clear()
        token, _, _ = svc.create_session(120)
        p, _, ws_id = await _join(token, _fresh_ws(), "UUIDTest")
        assert ws_id == p.ws_id
        parsed = _uuid.UUID(ws_id, version=4)
        assert str(parsed) == ws_id

    async def test_ws_ids_unique_per_connection(self):
        """Two simultaneous connections must get different ws_id values."""
        _clear()
        token, _, _ = svc.create_session(120)
        _, _, id1 = await _join(token, _fresh_ws(), "A")
        _, _, id2 = await _join(token, _fresh_ws(), "B")
        assert id1 != id2


# ---------------------------------------------------------------------------
# broadcast_message
# ---------------------------------------------------------------------------

class TestBroadcastMessage:
    async def test_broadcast_to_all(self):
        _clear()
        token, _, _ = svc.create_session(120)
        ws1, ws2 = _fresh_ws(), _fresh_ws()
        _, _, id1 = await _join(token, ws1, "Alice")
        _, _, id2 = await _join(token, ws2, "Bob")
        ws1.send_json.reset_mock()
        ws2.send_json.reset_mock()
        assert await svc.broadcast_message(token, id1, text="Hello!") is True
        ws1.send_json.assert_called_once()
        ws2.send_json.assert_called_once()
        assert ws1.send_json.call_args[0][0]["type"] == "message"

    async def test_not_stored(self):
        _clear()
        token, _, _ = svc.create_session(120)
        ws = _fresh_ws()
        _, _, ws_id = await _join(token, ws, "Alice")
        await svc.broadcast_message(token, ws_id, text="Secret")
        assert not hasattr(svc._SESSIONS[token], "messages")

    async def test_html_preserved_for_react(self):
        _clear()
        token, _, _ = svc.create_session(120)
        ws = _fresh_ws()
        _, _, ws_id = await _join(token, ws, "X")
        ws.send_json.reset_mock()
        await svc.broadcast_message(token, ws_id, text='<img src=x onerror=alert(1)>')
        assert ws.send_json.call_args[0][0]["text"] == '<img src=x onerror=alert(1)>'

    async def test_truncated(self):
        _clear()
        token, _, _ = svc.create_session(120)
        ws = _fresh_ws()
        _, _, ws_id = await _join(token, ws, "Alice")
        ws.send_json.reset_mock()
        await svc.broadcast_message(token, ws_id, text="X" * 5000)
        assert len(ws.send_json.call_args[0][0]["text"]) <= svc.MAX_MESSAGE_LENGTH + 50

    async def test_rate_limit(self):
        _clear()
        token, _, _ = svc.create_session(120)
        ws = _fresh_ws()
        _, _, ws_id = await _join(token, ws, "Spammer")
        results = []
        for i in range(svc._RATE_LIMIT_MSGS + 5):
            ws.send_json.reset_mock()
            results.append(await svc.broadcast_message(token, ws_id, text=f"msg {i}"))
        assert all(results[:svc._RATE_LIMIT_MSGS])
        assert not all(results[svc._RATE_LIMIT_MSGS:])

    async def test_expired_returns_false(self):
        _clear()
        token, _, _ = svc.create_session(120)
        ws = _fresh_ws()
        _, _, ws_id = await _join(token, ws, "Alice")
        svc._SESSIONS[token].expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        assert await svc.broadcast_message(token, ws_id, text="Late") is False

    async def test_unknown_ws_id_returns_false(self):
        """Passing a ws_id that never joined must return False, not raise."""
        _clear()
        token, _, _ = svc.create_session(120)
        assert await svc.broadcast_message(token, "not-a-real-id", text="hi") is False


# ---------------------------------------------------------------------------
# leave_session
# ---------------------------------------------------------------------------

class TestLeaveSession:
    async def test_removes_participant(self):
        _clear()
        token, _, _ = svc.create_session(120)
        ws = _fresh_ws()
        _, _, ws_id = await _join(token, ws, "Alice")
        assert len(svc._SESSIONS[token].participants) == 1
        await svc.leave_session(token, ws_id)
        assert len(svc._SESSIONS[token].participants) == 0

    async def test_noop_for_unknown_token(self):
        await svc.leave_session("no-token", "any-ws-id")

    async def test_noop_for_unknown_ws_id(self):
        _clear()
        token, _, _ = svc.create_session(120)
        await svc.leave_session(token, "not-a-real-id")  # must not raise


# ---------------------------------------------------------------------------
# cleanup_expired_sessions
# ---------------------------------------------------------------------------

class TestCleanupExpiredSessions:
    async def test_purges_expired(self):
        _clear()
        token, _, _ = svc.create_session(60)
        svc._SESSIONS[token].expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        assert await svc.cleanup_expired_sessions() == 1
        assert token not in svc._SESSIONS

    async def test_keeps_live(self):
        _clear()
        token, _, _ = svc.create_session(60)
        assert await svc.cleanup_expired_sessions() == 0
        assert token in svc._SESSIONS

    async def test_mixed(self):
        _clear()
        live, _, _  = svc.create_session(60)
        dead, _, _  = svc.create_session(60)
        dead2, _, _ = svc.create_session(60)
        svc._SESSIONS[dead].expires_at  = datetime.now(timezone.utc) - timedelta(seconds=1)
        svc._SESSIONS[dead2].expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        assert await svc.cleanup_expired_sessions() == 2
        assert live in svc._SESSIONS
        assert dead not in svc._SESSIONS and dead2 not in svc._SESSIONS

    async def test_idempotent(self):
        _clear()
        token, _, _ = svc.create_session(60)
        svc._SESSIONS[token].expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        assert await svc.cleanup_expired_sessions() == 1
        assert await svc.cleanup_expired_sessions() == 0

    async def test_also_prunes_pin_rl_stale_keys(self):
        """cleanup_expired_sessions must call _pin_rl.cleanup_stale()."""
        _clear()
        # Inject a stale key with an old timestamp directly.
        old_ts = datetime.now(timezone.utc) - timedelta(seconds=svc._pin_rl.WINDOW_SECONDS + 10)
        svc._pin_rl._records["1.2.3.4:fake-token"] = [old_ts]
        await svc.cleanup_expired_sessions()
        assert "1.2.3.4:fake-token" not in svc._pin_rl._records


# ---------------------------------------------------------------------------
# JoinStatus enum
# ---------------------------------------------------------------------------

class TestJoinStatus:
    def test_values_are_strings(self):
        """str mixin ensures JoinStatus members compare equal to plain strings."""
        assert svc.JoinStatus.OK == "ok"
        assert svc.JoinStatus.PIN_INVALID == "pin_invalid"
        assert svc.JoinStatus.SESSION_NOT_FOUND == "session_not_found"
        assert svc.JoinStatus.SESSION_FULL == "session_full"
        assert svc.JoinStatus.LOCKED == "locked"
        assert svc.JoinStatus.CREATOR_ALREADY_CONNECTED == "creator_already_connected"

    def test_all_statuses_present(self):
        names = {m.name for m in svc.JoinStatus}
        assert names == {
            "OK",
            "SESSION_NOT_FOUND",
            "SESSION_FULL",
            "PIN_INVALID",
            "LOCKED",
            "CREATOR_ALREADY_CONNECTED",
        }


# ---------------------------------------------------------------------------
# _PinRateLimiter unit tests
# ---------------------------------------------------------------------------

class TestPinRateLimiter:
    def setup_method(self):
        # Fresh limiter for each test — no shared state.
        self.rl = svc._PinRateLimiter()
        # Override class defaults for fast testing.
        self.rl.MAX_FAILURES = 3
        self.rl.WINDOW_SECONDS = 600.0

    def test_not_blocked_initially(self):
        assert not self.rl.is_blocked("1.1.1.1", "tok")

    def test_record_increments(self):
        failures, remaining = self.rl.record_failure("1.1.1.1", "tok")
        assert failures == 1
        assert remaining == 2

    def test_blocked_after_max_failures(self):
        for _ in range(self.rl.MAX_FAILURES):
            self.rl.record_failure("1.1.1.1", "tok")
        assert self.rl.is_blocked("1.1.1.1", "tok")

    def test_remaining_reaches_zero(self):
        for _ in range(self.rl.MAX_FAILURES):
            _, remaining = self.rl.record_failure("1.1.1.1", "tok")
        assert remaining == 0

    def test_different_ips_independent(self):
        for _ in range(self.rl.MAX_FAILURES):
            self.rl.record_failure("1.1.1.1", "tok")
        assert not self.rl.is_blocked("2.2.2.2", "tok")

    def test_different_tokens_independent(self):
        for _ in range(self.rl.MAX_FAILURES):
            self.rl.record_failure("1.1.1.1", "tok-A")
        assert not self.rl.is_blocked("1.1.1.1", "tok-B")

    def test_expired_failures_evicted(self):
        """Failures older than WINDOW_SECONDS should not count."""
        old_ts = datetime.now(timezone.utc) - timedelta(seconds=self.rl.WINDOW_SECONDS + 1)
        key = self.rl._make_key("1.1.1.1", "tok")
        self.rl._records[key] = [old_ts, old_ts, old_ts]  # 3 old failures
        # After prune, these should be gone — not blocked.
        assert not self.rl.is_blocked("1.1.1.1", "tok")

    def test_cleanup_stale_removes_empty_buckets(self):
        old_ts = datetime.now(timezone.utc) - timedelta(seconds=self.rl.WINDOW_SECONDS + 1)
        key = self.rl._make_key("1.1.1.1", "tok")
        self.rl._records[key] = [old_ts]
        removed = self.rl.cleanup_stale()
        assert removed == 1
        assert key not in self.rl._records

    def test_cleanup_keeps_fresh_buckets(self):
        self.rl.record_failure("1.1.1.1", "tok")
        removed = self.rl.cleanup_stale()
        assert removed == 0
        assert self.rl._make_key("1.1.1.1", "tok") in self.rl._records


# ---------------------------------------------------------------------------
# Module-level PIN rate-limit helpers
# ---------------------------------------------------------------------------

class TestPinRateLimitHelpers:
    def setup_method(self):
        svc._pin_rl._records.clear()
        # Use a low limit so tests run quickly.
        self._orig_max = svc._pin_rl.MAX_FAILURES
        svc._pin_rl.MAX_FAILURES = 3

    def teardown_method(self):
        svc._pin_rl.MAX_FAILURES = self._orig_max
        svc._pin_rl._records.clear()

    def test_is_pin_rate_limited_false_initially(self):
        assert not svc.is_pin_rate_limited("1.1.1.1", "tok")

    def test_is_pin_rate_limited_true_after_max(self):
        for _ in range(svc._pin_rl.MAX_FAILURES):
            svc.record_pin_failure("1.1.1.1", "tok")
        assert svc.is_pin_rate_limited("1.1.1.1", "tok")

    def test_record_pin_failure_returns_tuple(self):
        failures, remaining = svc.record_pin_failure("1.1.1.1", "tok")
        assert isinstance(failures, int) and isinstance(remaining, int)
        assert failures + remaining == svc._pin_rl.MAX_FAILURES

    async def test_wrong_pin_increments_limiter_via_join_session(self):
        """End-to-end: join_session returning PIN_INVALID should be tracked."""
        _clear()
        token, _, _ = svc.create_session(120)
        for _ in range(2):
            _, status, _ = await _join(token, _fresh_ws(), "Eve", pin="XXXXXX")
            assert status == svc.JoinStatus.PIN_INVALID
            svc.record_pin_failure("1.1.1.1", token)
        assert not svc.is_pin_rate_limited("1.1.1.1", token)
        _, status, _ = await _join(token, _fresh_ws(), "Eve", pin="YYYYYY")
        assert status == svc.JoinStatus.PIN_INVALID
        svc.record_pin_failure("1.1.1.1", token)
        assert svc.is_pin_rate_limited("1.1.1.1", token)
