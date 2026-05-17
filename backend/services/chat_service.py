"""
Burn Chat service — in-memory ephemeral messaging.

Design principles
-----------------
* Messages are NEVER written to disk or the database — zero residue.
* Messages are broadcast directly to connected WebSocket clients and then
  discarded.  No server-side message history is kept; if a participant
  reconnects within the TTL they start with a blank slate (true ephemeral).
* Sessions auto-destruct when their TTL expires:
    1.  Server broadcasts ``{"type": "destroyed"}`` to every connected client.
    2.  All WebSocket connections are closed.
    3.  The session dict entry is deleted → Python GC frees the memory.
* Creator identity is verified by a short one-time PIN that is returned
  ONCE at session creation and never stored in any log or database.
"""

from __future__ import annotations

import asyncio
import html
import logging
import os
import secrets
import string
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional

from fastapi import WebSocket

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

#: Minimum session lifetime (seconds).
MIN_TTL_SECONDS: int = 30

#: Maximum session lifetime (seconds) — 72 hours.
MAX_TTL_SECONDS: int = 72 * 3600

#: Maximum number of concurrent sessions server-wide.
MAX_SESSIONS: int = max(1, int(os.getenv("MAX_CHAT_SESSIONS", "500")))

#: Maximum concurrent WebSocket connections per session.
MAX_PARTICIPANTS: int = 50

#: Maximum characters per message.
MAX_MESSAGE_LENGTH: int = 2_000

#: Maximum display-name length.
MAX_NAME_LENGTH: int = 30

#: Rate-limit: messages per window per participant.
_RATE_LIMIT_MSGS: int = 10
_RATE_WINDOW_SECS: float = 30.0

#: PIN character pool — uppercase letters + digits (easy to read, no 0/O ambiguity).
_PIN_ALPHABET: str = "".join(
    c for c in (string.ascii_uppercase + string.digits) if c not in "0O1I"
)

#: Length of the creator PIN.
_PIN_LENGTH: int = 6

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _generate_pin() -> str:
    """Return a cryptographically random, human-readable PIN."""
    return "".join(secrets.choice(_PIN_ALPHABET) for _ in range(_PIN_LENGTH))


def _safe_text(raw: str, max_len: int) -> str:
    """Strip HTML from *raw* and truncate to *max_len* characters."""
    return html.escape(raw[:max_len], quote=True)


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class _Participant:
    """State for a single WebSocket connection within a chat session."""

    ws: WebSocket
    name: str
    is_creator: bool = False

    # Rate-limit tracking — reset every _RATE_WINDOW_SECS seconds.
    _msg_count: int = field(default=0, repr=False)
    _window_start: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc), repr=False
    )


@dataclass
class _ChatSession:
    """
    In-memory state for one Burn Chat session.

    ``participants`` is keyed by ``str(id(websocket))`` so each WS object
    maps to exactly one participant entry even if the same remote user opens
    two tabs.
    """

    token: str
    creator_pin: str  # stored only in RAM — never in DB / logs
    expires_at: datetime
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    participants: Dict[str, _Participant] = field(default_factory=dict)
    _destroy_task: Optional[asyncio.Task] = field(default=None, repr=False)


# ---------------------------------------------------------------------------
# Global in-memory store (single-process; intentionally not Redis/DB)
# ---------------------------------------------------------------------------

_SESSIONS: Dict[str, _ChatSession] = {}


# ---------------------------------------------------------------------------
# Broadcast helper
# ---------------------------------------------------------------------------


async def _broadcast(
    session: _ChatSession,
    payload: dict,
    exclude_ws: Optional[WebSocket] = None,
) -> None:
    """
    Send *payload* as JSON to every participant in *session*.

    Dead connections are silently removed from the participants dict so
    they do not accumulate across the session lifetime.
    """
    dead: list[str] = []
    for ws_id, participant in list(session.participants.items()):
        if participant.ws is exclude_ws:
            continue
        try:
            await participant.ws.send_json(payload)
        except Exception:
            dead.append(ws_id)

    for ws_id in dead:
        session.participants.pop(ws_id, None)


# ---------------------------------------------------------------------------
# Session lifecycle
# ---------------------------------------------------------------------------


async def _countdown_loop(token: str, session: _ChatSession) -> None:
    """
    Background task for a session.

    Sends ``{"type": "countdown", "seconds_remaining": N}`` ticks to all
    participants:
      - Every 10 s when more than 60 s remain.
      - Every 1 s when ≤ 60 s remain (so the UI can animate a smooth timer).

    Calls ``_destroy_session`` when the TTL expires.
    """
    try:
        while True:
            now = datetime.now(timezone.utc)
            remaining = (session.expires_at - now).total_seconds()

            if remaining <= 0:
                break

            # Sleep until the next tick.
            interval = 1.0 if remaining <= 60 else 10.0
            await asyncio.sleep(min(interval, max(remaining, 0)))

            # Recompute after sleep.
            now = datetime.now(timezone.utc)
            remaining = max(0.0, (session.expires_at - now).total_seconds())

            if remaining > 0:
                await _broadcast(
                    session,
                    {"type": "countdown", "seconds_remaining": int(remaining)},
                )
            else:
                break

    except asyncio.CancelledError:
        # Session was destroyed externally (e.g. safety-net cleanup).
        return

    # TTL expired — destroy the session.
    await _destroy_session(token)


async def _destroy_session(token: str) -> None:
    """
    Destroy a chat session completely.

    1. Broadcasts ``{"type": "destroyed"}`` to all connected clients.
    2. Closes every WebSocket.
    3. Removes the session from ``_SESSIONS`` — GC frees the memory.

    Idempotent: calling it on an already-destroyed session is a no-op.
    """
    session = _SESSIONS.get(token)
    if session is None:
        return  # Already destroyed.

    logger.info("Destroying burn chat session %s…", token[:8])

    # Broadcast the destroy event so every client can show the burn animation.
    await _broadcast(session, {"type": "destroyed"})

    # Close all WebSocket connections.
    for participant in list(session.participants.values()):
        try:
            await participant.ws.close(code=1000, reason="Session expired")
        except Exception:
            pass

    # Remove from memory — this is the burn.
    _SESSIONS.pop(token, None)
    logger.info(
        "Burn chat session %s destroyed and purged from RAM.", token[:8]
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def create_session(ttl_seconds: int) -> tuple[str, str, datetime]:
    """
    Create a new Burn Chat session.

    Args:
        ttl_seconds: Lifetime of the session in seconds.
                     Must be in [MIN_TTL_SECONDS, MAX_TTL_SECONDS].

    Returns:
        ``(token, creator_pin, expires_at)`` — the PIN is returned **once**
        here and never persisted anywhere else.

    Raises:
        ValueError:   Invalid TTL.
        RuntimeError: Server-wide session cap reached.
    """
    if not (MIN_TTL_SECONDS <= ttl_seconds <= MAX_TTL_SECONDS):
        raise ValueError(
            f"ttl_seconds must be between {MIN_TTL_SECONDS} and {MAX_TTL_SECONDS}"
        )
    if len(_SESSIONS) >= MAX_SESSIONS:
        raise RuntimeError("Maximum concurrent chat sessions reached — try again later")

    token = str(uuid.uuid4())
    pin = _generate_pin()
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)

    session = _ChatSession(token=token, creator_pin=pin, expires_at=expires_at)
    _SESSIONS[token] = session

    # Start the countdown / auto-destroy background task.
    task = asyncio.create_task(_countdown_loop(token, session))
    session._destroy_task = task

    logger.info(
        "Created burn chat session %s (TTL=%ds, expires=%s)",
        token[:8],
        ttl_seconds,
        expires_at.isoformat(),
    )
    return token, pin, expires_at


def get_session(token: str) -> Optional[_ChatSession]:
    """
    Return the live session for *token*, or ``None`` if expired / not found.

    Does NOT mutate state — safe to call from read paths.
    """
    session = _SESSIONS.get(token)
    if session is None:
        return None
    if datetime.now(timezone.utc) >= session.expires_at:
        # The countdown task should destroy it, but return None conservatively.
        return None
    return session


def session_info(token: str) -> Optional[dict]:
    """
    Return a public, non-sensitive summary of the session — for the
    REST info endpoint.  Returns ``None`` if the session is not found.
    """
    session = get_session(token)
    if session is None:
        return None
    now = datetime.now(timezone.utc)
    remaining = max(0, int((session.expires_at - now).total_seconds()))
    return {
        "token": token,
        "expires_at": session.expires_at.isoformat(),
        "seconds_remaining": remaining,
        "participant_count": len(session.participants),
        "created_at": session.created_at.isoformat(),
    }


async def join_session(
    token: str,
    ws: WebSocket,
    display_name: str,
    pin: Optional[str] = None,
) -> Optional[_Participant]:
    """
    Register a WebSocket connection as a participant in *token*'s session.

    Args:
        token:        Session token.
        ws:           The caller's WebSocket connection.
        display_name: Chosen display name (≤ MAX_NAME_LENGTH chars).
        pin:          Optional creator PIN.  If it matches, the participant
                      is flagged as ``is_creator = True``.

    Returns:
        The ``_Participant`` object, or ``None`` if the session is full /
        not found.  On success, the session info is sent to the new client
        and a system message is broadcast to existing participants.

    Note:
        Messages are NOT replayed on join — this is intentional (true
        ephemeral / burn-chat behaviour).  Participants only see messages
        that arrive after they connect.
    """
    session = get_session(token)
    if session is None:
        return None

    if len(session.participants) >= MAX_PARTICIPANTS:
        return None

    # Validate PIN with constant-time comparison to prevent timing attacks.
    is_creator = bool(
        pin and secrets.compare_digest(pin.strip().upper(), session.creator_pin)
    )

    safe_name = _safe_text(display_name, MAX_NAME_LENGTH) or "Anonymous"
    ws_id = str(id(ws))
    participant = _Participant(ws=ws, name=safe_name, is_creator=is_creator)
    session.participants[ws_id] = participant

    # Notify existing participants.
    role_label = "creator" if is_creator else "participant"
    await _broadcast(
        session,
        {
            "type": "system",
            "text": f"{safe_name} joined as {role_label}",
            "participant_count": len(session.participants),
        },
        exclude_ws=ws,
    )

    # Send session info to the new joiner.
    now = datetime.now(timezone.utc)
    remaining = max(0, int((session.expires_at - now).total_seconds()))
    await ws.send_json(
        {
            "type": "joined",
            "token": token,
            "is_creator": is_creator,
            "seconds_remaining": remaining,
            "participant_count": len(session.participants),
            "expires_at": session.expires_at.isoformat(),
            # No message history — burn chat participants start fresh.
        }
    )

    return participant


async def broadcast_message(
    token: str,
    ws: WebSocket,
    text: str,
) -> bool:
    """
    Broadcast a chat message from *ws* to all participants in the session.

    Messages are NOT stored anywhere after broadcast — they exist only in
    connected clients' DOM until those clients clear their state or the
    session is destroyed.

    Args:
        token: Session token.
        ws:    Sender's WebSocket.
        text:  Raw message text (will be HTML-escaped and truncated).

    Returns:
        ``True`` if the message was broadcast, ``False`` if the session is
        expired, the sender is not registered, or the rate limit is exceeded.
    """
    session = get_session(token)
    if session is None:
        return False

    ws_id = str(id(ws))
    participant = session.participants.get(ws_id)
    if participant is None:
        return False

    # Per-participant rate limiting.
    now = datetime.now(timezone.utc)
    elapsed = (now - participant._window_start).total_seconds()
    if elapsed > _RATE_WINDOW_SECS:
        participant._msg_count = 0
        participant._window_start = now

    if participant._msg_count >= _RATE_LIMIT_MSGS:
        try:
            await ws.send_json(
                {
                    "type": "error",
                    "text": "Slow down — you are sending messages too quickly.",
                }
            )
        except Exception:
            pass
        return False

    participant._msg_count += 1

    # Sanitise content.
    safe_text = _safe_text(text, MAX_MESSAGE_LENGTH)
    if not safe_text:
        return False

    payload = {
        "type": "message",
        "id": str(uuid.uuid4()),
        "sender_name": participant.name,
        "text": safe_text,
        "sent_at": now.isoformat(),
        "is_creator": participant.is_creator,
    }

    # Broadcast — NOT stored server-side.
    await _broadcast(session, payload)
    return True


async def leave_session(token: str, ws: WebSocket) -> None:
    """
    Remove *ws* from the session's participant list and notify others.

    Safe to call even if the session is already destroyed or *ws* was never
    registered.
    """
    session = _SESSIONS.get(token)  # Use raw dict — session may be expired.
    if session is None:
        return

    ws_id = str(id(ws))
    participant = session.participants.pop(ws_id, None)
    if participant:
        await _broadcast(
            session,
            {
                "type": "system",
                "text": f"{participant.name} left",
                "participant_count": len(session.participants),
            },
        )


# ---------------------------------------------------------------------------
# Safety-net cleanup (called by services/cleanup.py)
# ---------------------------------------------------------------------------


def cleanup_expired_sessions() -> int:
    """
    Synchronous safety-net: remove sessions whose TTL has elapsed but whose
    background destroy task may have crashed.

    Returns the number of sessions purged.  Async broadcast is intentionally
    skipped here — if the task crashed, WebSocket connections are likely
    already dead.
    """
    now = datetime.now(timezone.utc)
    expired_tokens = [
        t for t, s in list(_SESSIONS.items()) if now >= s.expires_at
    ]
    for token in expired_tokens:
        session = _SESSIONS.pop(token, None)
        if session and session._destroy_task and not session._destroy_task.done():
            session._destroy_task.cancel()
        logger.warning(
            "Safety-net cleanup: removed stale chat session %s", token[:8]
        )
    return len(expired_tokens)
