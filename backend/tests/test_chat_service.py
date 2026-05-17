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

# All tests may be async — auto mode handles both sync and async.
pytestmark = pytest.mark.asyncio


def _fresh_ws() -> MagicMock:
    ws = MagicMock()
    ws.send_json = AsyncMock()
    ws.close     = AsyncMock()
    return ws


def _clear():
    svc._SESSIONS.clear()


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
    def test_strips_script_tag(self):
        assert "<script>" not in svc._safe_text("<script>alert(1)</script>", 2000)

    def test_escapes_quotes(self):
        assert '"' not in svc._safe_text('say "hi"', 2000)

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
        p = await svc.join_session(token, _fresh_ws(), "Alice")
        assert p and not p.is_creator

    async def test_creator_correct_pin(self):
        _clear()
        token, pin, _ = svc.create_session(120)
        p = await svc.join_session(token, _fresh_ws(), "Bob", pin=pin)
        assert p and p.is_creator

    async def test_creator_wrong_pin(self):
        _clear()
        token, _, _ = svc.create_session(120)
        p = await svc.join_session(token, _fresh_ws(), "Eve", pin="XXXXXX")
        assert p and not p.is_creator

    async def test_expired_returns_none(self):
        _clear()
        token, _, _ = svc.create_session(120)
        svc._SESSIONS[token].expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        assert await svc.join_session(token, _fresh_ws(), "Ghost") is None

    async def test_joined_event_sent(self):
        _clear()
        token, _, _ = svc.create_session(120)
        ws = _fresh_ws()
        await svc.join_session(token, ws, "Charlie")
        payload = ws.send_json.call_args_list[-1][0][0]
        assert payload["type"] == "joined"

    async def test_participant_cap(self):
        _clear()
        orig = svc.MAX_PARTICIPANTS
        svc.MAX_PARTICIPANTS = 2
        try:
            token, _, _ = svc.create_session(120)
            ws1, ws2, ws3 = _fresh_ws(), _fresh_ws(), _fresh_ws()
            assert await svc.join_session(token, ws1, "P1") is not None
            assert await svc.join_session(token, ws2, "P2") is not None
            assert await svc.join_session(token, ws3, "P3") is None
        finally:
            svc.MAX_PARTICIPANTS = orig

    async def test_name_sanitised(self):
        _clear()
        token, _, _ = svc.create_session(120)
        p = await svc.join_session(token, _fresh_ws(), "<b>Hack</b>")
        assert "<b>" not in p.name

    async def test_no_history_on_join(self):
        _clear()
        token, _, _ = svc.create_session(120)
        ws = _fresh_ws()
        await svc.join_session(token, ws, "NoHistory")
        payload = ws.send_json.call_args_list[-1][0][0]
        assert "messages" not in payload


# ---------------------------------------------------------------------------
# broadcast_message
# ---------------------------------------------------------------------------

class TestBroadcastMessage:
    async def test_broadcast_to_all(self):
        _clear()
        token, _, _ = svc.create_session(120)
        ws1, ws2 = _fresh_ws(), _fresh_ws()
        await svc.join_session(token, ws1, "Alice")
        await svc.join_session(token, ws2, "Bob")
        ws1.send_json.reset_mock(); ws2.send_json.reset_mock()
        assert await svc.broadcast_message(token, ws1, "Hello!") is True
        ws1.send_json.assert_called_once()
        ws2.send_json.assert_called_once()
        assert ws1.send_json.call_args[0][0]["type"] == "message"

    async def test_not_stored(self):
        _clear()
        token, _, _ = svc.create_session(120)
        ws = _fresh_ws()
        await svc.join_session(token, ws, "Alice")
        await svc.broadcast_message(token, ws, "Secret")
        assert not hasattr(svc._SESSIONS[token], "messages")

    async def test_html_escaped(self):
        _clear()
        token, _, _ = svc.create_session(120)
        ws = _fresh_ws()
        await svc.join_session(token, ws, "X")
        ws.send_json.reset_mock()
        await svc.broadcast_message(token, ws, '<img src=x onerror=alert(1)>')
        assert "<img" not in ws.send_json.call_args[0][0]["text"]

    async def test_truncated(self):
        _clear()
        token, _, _ = svc.create_session(120)
        ws = _fresh_ws()
        await svc.join_session(token, ws, "Alice")
        ws.send_json.reset_mock()
        await svc.broadcast_message(token, ws, "X" * 5000)
        assert len(ws.send_json.call_args[0][0]["text"]) <= svc.MAX_MESSAGE_LENGTH + 50

    async def test_rate_limit(self):
        _clear()
        token, _, _ = svc.create_session(120)
        ws = _fresh_ws()
        await svc.join_session(token, ws, "Spammer")
        results = []
        for i in range(svc._RATE_LIMIT_MSGS + 5):
            ws.send_json.reset_mock()
            results.append(await svc.broadcast_message(token, ws, f"msg {i}"))
        assert all(results[:svc._RATE_LIMIT_MSGS])
        assert not all(results[svc._RATE_LIMIT_MSGS:])

    async def test_expired_returns_false(self):
        _clear()
        token, _, _ = svc.create_session(120)
        ws = _fresh_ws()
        await svc.join_session(token, ws, "Alice")
        svc._SESSIONS[token].expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        assert await svc.broadcast_message(token, ws, "Late") is False


# ---------------------------------------------------------------------------
# leave_session
# ---------------------------------------------------------------------------

class TestLeaveSession:
    async def test_removes_participant(self):
        _clear()
        token, _, _ = svc.create_session(120)
        ws = _fresh_ws()
        await svc.join_session(token, ws, "Alice")
        assert len(svc._SESSIONS[token].participants) == 1
        await svc.leave_session(token, ws)
        assert len(svc._SESSIONS[token].participants) == 0

    async def test_noop_for_unknown(self):
        await svc.leave_session("no-token", _fresh_ws())


# ---------------------------------------------------------------------------
# cleanup_expired_sessions
# ---------------------------------------------------------------------------

class TestCleanupExpiredSessions:
    async def test_purges_expired(self):
        _clear()
        token, _, _ = svc.create_session(60)
        svc._SESSIONS[token].expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        assert svc.cleanup_expired_sessions() == 1
        assert token not in svc._SESSIONS

    async def test_keeps_live(self):
        _clear()
        token, _, _ = svc.create_session(60)
        assert svc.cleanup_expired_sessions() == 0
        assert token in svc._SESSIONS

    async def test_mixed(self):
        _clear()
        live, _, _  = svc.create_session(60)
        dead, _, _  = svc.create_session(60)
        dead2, _, _ = svc.create_session(60)
        svc._SESSIONS[dead].expires_at  = datetime.now(timezone.utc) - timedelta(seconds=1)
        svc._SESSIONS[dead2].expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        assert svc.cleanup_expired_sessions() == 2
        assert live in svc._SESSIONS
        assert dead not in svc._SESSIONS and dead2 not in svc._SESSIONS

    async def test_idempotent(self):
        _clear()
        token, _, _ = svc.create_session(60)
        svc._SESSIONS[token].expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        assert svc.cleanup_expired_sessions() == 1
        assert svc.cleanup_expired_sessions() == 0
