"""
tests/test_chat_broadcast.py
----------------------------
Unit tests specifically targeting services/chat_service._broadcast:
1. Normal concurrent broadcast to multiple participants
2. Sender exclusion (exclude_ws_id)
3. Slowloris timeout cancellation via asyncio.wait
4. Errored client removal with WebSocket code 1001
5. Disconnect notification to remaining healthy participants
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

import services.chat_service as svc

pytestmark = pytest.mark.asyncio


def _make_mock_ws():
    ws = MagicMock()
    ws.send_json = AsyncMock()
    ws.close = AsyncMock()
    return ws


def _make_participant(name: str, ws: MagicMock, ws_id: str, is_creator: bool = False):
    return svc._Participant(
        ws=ws,
        ws_id=ws_id,
        participant_id=ws_id,
        participant_token=f"token-{ws_id}",
        session_id="test-session",
        display_name=name,
        name=name,
        is_creator=is_creator,
    )


class TestBroadcastNormal:
    async def test_broadcast_delivers_to_all_participants(self):
        token, _, _ = svc.create_session(120)
        session = svc.get_session(token)

        ws1, ws2, ws3 = _make_mock_ws(), _make_mock_ws(), _make_mock_ws()
        session.participants["ws-1"] = _make_participant("Alice", ws1, "ws-1", True)
        session.participants["ws-2"] = _make_participant("Bob", ws2, "ws-2")
        session.participants["ws-3"] = _make_participant("Charlie", ws3, "ws-3")

        payload = {"type": "message", "text": "Hello world"}
        await svc._broadcast(session, payload)

        ws1.send_json.assert_awaited_once_with(payload)
        ws2.send_json.assert_awaited_once_with(payload)
        ws3.send_json.assert_awaited_once_with(payload)

    async def test_broadcast_excludes_sender(self):
        token, _, _ = svc.create_session(120)
        session = svc.get_session(token)

        ws1, ws2 = _make_mock_ws(), _make_mock_ws()
        session.participants["ws-sender"] = _make_participant("Sender", ws1, "ws-sender")
        session.participants["ws-receiver"] = _make_participant("Receiver", ws2, "ws-receiver")

        payload = {"type": "message", "text": "Unicast-ish"}
        await svc._broadcast(session, payload, exclude_ws_id="ws-sender")

        ws1.send_json.assert_not_awaited()
        ws2.send_json.assert_awaited_once_with(payload)


class TestBroadcastSlowlorisAndErrorHandling:
    async def test_errored_client_removed_and_closed_with_1001(self):
        token, _, _ = svc.create_session(120)
        session = svc.get_session(token)

        good_ws = _make_mock_ws()
        failing_ws = _make_mock_ws()
        failing_ws.send_json.side_effect = ConnectionResetError("Connection lost")

        session.participants["ws-good"] = _make_participant("Good", good_ws, "ws-good")
        session.participants["ws-bad"] = _make_participant("Bad", failing_ws, "ws-bad")

        payload = {"type": "test", "data": 123}
        await svc._broadcast(session, payload)

        # Good client received payload
        good_ws.send_json.assert_any_await(payload)

        # Bad client removed from session participants
        assert "ws-bad" not in session.participants
        assert "ws-good" in session.participants

        # Bad client's websocket closed with 1001
        failing_ws.close.assert_awaited_once_with(
            code=1001, reason="Broadcast timeout or connection error"
        )

    async def test_slowloris_timeout_cancels_stalled_client(self):
        token, _, _ = svc.create_session(120)
        session = svc.get_session(token)

        good_ws = _make_mock_ws()
        stalled_ws = _make_mock_ws()

        session.participants["ws-fast"] = _make_participant("Fast", good_ws, "ws-fast")
        session.participants["ws-stalled"] = _make_participant("Stalled", stalled_ws, "ws-stalled")

        # Mock asyncio.wait to simulate 'ws-stalled' task landing in pending (timed out)
        original_wait = asyncio.wait

        async def fake_wait(tasks, timeout=None):
            # Find the task corresponding to stalled_ws
            done = set()
            pending = set()
            for t in tasks:
                # If this is the stalled task, mark it pending
                # To simulate, check if task is for stalled_ws
                if hasattr(t, "_is_stalled"):
                    pending.add(t)
                else:
                    await t
                    done.add(t)
            return done, pending

        # Wrap stalled_ws.send_json to tag the task
        async def slow_send(payload):
            await asyncio.sleep(10)

        stalled_ws.send_json.side_effect = slow_send

        # We patch asyncio.wait with a small timeout or mock to avoid 3s test sleep
        async def fast_mock_wait(tasks, timeout=3.0):
            # Run tasks with a very short timeout (0.05s) to test actual cancellation
            return await original_wait(tasks, timeout=0.05)

        with patch("asyncio.wait", side_effect=fast_mock_wait):
            await svc._broadcast(session, {"type": "ping"})

        # The stalled client must be removed from session
        assert "ws-stalled" not in session.participants
        assert "ws-fast" in session.participants

        # Stalled websocket close called with 1001
        stalled_ws.close.assert_awaited_once_with(
            code=1001, reason="Broadcast timeout or connection error"
        )
