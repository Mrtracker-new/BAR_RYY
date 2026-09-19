"""
Regression tests for BurnChat participant identity decoupling.

Verifies:
1. Display names are purely cosmetic and non-unique.
2. Every participant receives a unique UUIDv4 participant_id.
3. Participants sharing the same display name across or within sessions stay completely isolated.
4. Moderation (kick) targets participant_id, affecting only the targeted participant.
5. Backend data structures contain zero lookups by display_name.
"""

import pytest
from unittest.mock import AsyncMock
from services import chat_service


@pytest.fixture(autouse=True)
def cleanup_sessions():
    """Ensure _SESSIONS is clean before and after each test."""
    chat_service._SESSIONS.clear()
    yield
    chat_service._SESSIONS.clear()


@pytest.mark.asyncio
async def test_cross_session_identity_isolation():
    """Test 1: Two independent sessions with participants named 'Rolan' have distinct participant_ids."""
    token_a, pin_a, _ = chat_service.create_session(300)
    token_b, pin_b, _ = chat_service.create_session(300)

    ws_a = AsyncMock()
    ws_b = AsyncMock()

    part_a, status_a = await chat_service.join_session(token_a, ws_a, "Rolan")
    part_b, status_b = await chat_service.join_session(token_b, ws_b, "Rolan")

    assert status_a == chat_service.JoinStatus.OK
    assert status_b == chat_service.JoinStatus.OK

    assert part_a.participant_id != part_b.participant_id
    assert part_a.session_id == token_a
    assert part_b.session_id == token_b
    assert part_a.display_name == "Rolan"
    assert part_b.display_name == "Rolan"

    ws_a.reset_mock()
    ws_b.reset_mock()

    # Message in Session A should only go to Session A
    await chat_service.broadcast_message(token_a, part_a.participant_id, text="Hello A")
    ws_b.send_json.assert_not_called()


@pytest.mark.asyncio
async def test_same_session_duplicate_display_names():
    """Test 2: Three participants named 'Rolan' in the same session coexist cleanly."""
    token, pin, _ = chat_service.create_session(300)

    ws1 = AsyncMock()
    ws2 = AsyncMock()
    ws3 = AsyncMock()

    p1, s1 = await chat_service.join_session(token, ws1, "Rolan")
    p2, s2 = await chat_service.join_session(token, ws2, "Rolan")
    p3, s3 = await chat_service.join_session(token, ws3, "Rolan")

    assert s1 == chat_service.JoinStatus.OK
    assert s2 == chat_service.JoinStatus.OK
    assert s3 == chat_service.JoinStatus.OK

    pids = {p1.participant_id, p2.participant_id, p3.participant_id}
    assert len(pids) == 3, "All three participants must have unique participant_ids"

    session = chat_service.get_session(token)
    assert len(session.participants) == 3

    # Verify message payload carries sender_id
    ws1.reset_mock()
    ws2.reset_mock()
    ws3.reset_mock()

    await chat_service.broadcast_message(token, p1.participant_id, text="Message from Rolan 1")

    # ws2 and ws3 should receive message with sender_id matching p1.participant_id
    payload2 = ws2.send_json.call_args[0][0]
    assert payload2["type"] == "message"
    assert payload2["sender_id"] == p1.participant_id
    assert payload2["participant_id"] == p1.participant_id
    assert payload2["sender_name"] == "Rolan"


@pytest.mark.asyncio
async def test_reconnect_identity_restoration():
    """Test 3: Participant reconnect produces a new clean WS connection without identity collisions."""
    token, pin, _ = chat_service.create_session(300)

    ws_orig = AsyncMock()
    p_orig, s_orig = await chat_service.join_session(token, ws_orig, "Rolan")

    # Participant leaves
    await chat_service.leave_session(token, p_orig.participant_id)
    session = chat_service.get_session(token)
    assert len(session.participants) == 0

    # Participant reconnects
    ws_recon = AsyncMock()
    p_recon, s_recon = await chat_service.join_session(token, ws_recon, "Rolan")
    assert s_recon == chat_service.JoinStatus.OK
    assert len(session.participants) == 1
    assert p_recon.participant_id != p_orig.participant_id  # New secure session token


@pytest.mark.asyncio
async def test_creator_moderation_kick_by_participant_id():
    """Test 4: Creator kick targets participant_id, affecting ONLY the intended participant even if names match."""
    token, pin, _ = chat_service.create_session(300)

    ws_creator = AsyncMock()
    ws_user1 = AsyncMock()
    ws_user2 = AsyncMock()

    creator, _ = await chat_service.join_session(token, ws_creator, "CreatorRolan", pin=pin)
    user1, _ = await chat_service.join_session(token, ws_user1, "Rolan")
    user2, _ = await chat_service.join_session(token, ws_user2, "Rolan")

    session = chat_service.get_session(token)
    assert len(session.participants) == 3

    # Creator kicks user1 specifically by user1.participant_id
    kicked = await chat_service.kick_participant(token, creator.participant_id, user1.participant_id)
    assert kicked is True

    # User1 should be removed, User2 must remain
    assert user1.participant_id not in session.participants
    assert user2.participant_id in session.participants
    assert len(session.participants) == 2
    ws_user1.close.assert_called_once()
    ws_user2.close.assert_not_called()


def test_codebase_data_structures_zero_name_lookups():
    """Test 5: Audit backend chat_service code to confirm data structures do not key off display_name."""
    import inspect
    source = inspect.getsource(chat_service)

    # Confirm participants dictionary is keyed by ID and not display name
    assert "participants[display_name]" not in source
    assert "participants[name]" not in source
    assert "participants[participant_name]" not in source
