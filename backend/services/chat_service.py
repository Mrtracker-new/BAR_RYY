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
from enum import Enum
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
# Join result type
# ---------------------------------------------------------------------------


class JoinStatus(str, Enum):
    """
    Outcome of a :func:`join_session` call.

    Using ``str`` as a mixin makes instances JSON-serialisable and
    printable without an extra ``.value`` dereference.
    """

    OK = "ok"
    """Participant was registered and the session WS confirmed."""

    SESSION_NOT_FOUND = "session_not_found"
    """Token does not correspond to any live session."""

    SESSION_FULL = "session_full"
    """Room has reached MAX_PARTICIPANTS."""

    PIN_INVALID = "pin_invalid"
    """
    A creator PIN was supplied but did **not** match.

    The participant is **not** admitted.  The WS handler must record this
    failure against the rate limiter and may close the connection.
    """


# ---------------------------------------------------------------------------
# PIN brute-force rate limiter
# ---------------------------------------------------------------------------


class _PinRateLimiter:
    """
    Per-(client_ip, session_token) creator-PIN failure tracker.

    Maintains a sliding-window count of failed PIN guesses for each
    (IP address, session token) pair.  Once ``MAX_FAILURES`` failures
    accumulate inside ``WINDOW_SECONDS``, :meth:`is_blocked` returns
    ``True`` and the WS handshake rejects further PIN attempts.

    Design notes
    ------------
    *  All mutations happen on the single asyncio event loop thread
       (single uvicorn worker), so plain ``dict`` operations are race-free
       without asyncio locks.
    *  Only *failed* attempts are stored — successful creator logins do
       not consume quota and are not recorded here.
    *  Entries are pruned lazily on each call and eagerly during the
       periodic safety-net cleanup to prevent unbounded memory growth.
    *  ``MAX_FAILURES`` and ``WINDOW_SECONDS`` are read from environment
       variables at class-definition time so they can be tuned without
       code changes.
    """

    #: Maximum failed PIN attempts allowed inside the sliding window.
    MAX_FAILURES: int = int(os.getenv("CHAT_PIN_MAX_FAILURES", "3"))

    #: Sliding window length in seconds.  Failures older than this are
    #: automatically evicted and no longer count toward the limit.
    WINDOW_SECONDS: float = float(os.getenv("CHAT_PIN_WINDOW_SECS", "600"))

    def __init__(self) -> None:
        # {"<ip>:<token>": [failed_at, ...]}  — timestamps of failed attempts.
        self._records: Dict[str, list[datetime]] = {}

    # ── Private helpers ────────────────────────────────────────────────

    @staticmethod
    def _make_key(client_ip: str, token: str) -> str:
        """Stable composite key for the (IP, token) bucket."""
        return f"{client_ip}:{token}"

    def _prune(self, key: str, now: datetime) -> None:
        """Evict timestamps that have slid outside the current window."""
        cutoff = now - timedelta(seconds=self.WINDOW_SECONDS)
        records = self._records.get(key)
        if records is not None:
            self._records[key] = [ts for ts in records if ts > cutoff]

    # ── Public API ─────────────────────────────────────────────────────

    def is_blocked(self, client_ip: str, token: str) -> bool:
        """
        Return ``True`` if this (IP, token) pair has exhausted its
        allowed PIN attempts and should be rejected without calling
        :func:`join_session`.
        """
        key = self._make_key(client_ip, token)
        now = datetime.now(timezone.utc)
        self._prune(key, now)
        return len(self._records.get(key, [])) >= self.MAX_FAILURES

    def record_failure(self, client_ip: str, token: str) -> tuple[int, int]:
        """
        Record one failed PIN attempt for *client_ip* against *token*.

        Returns
        -------
        (failures_in_window, remaining_attempts)
            ``remaining_attempts`` is ``0`` when the caller is now blocked.
        """
        key = self._make_key(client_ip, token)
        now = datetime.now(timezone.utc)
        self._prune(key, now)
        if key not in self._records:
            self._records[key] = []
        self._records[key].append(now)
        failures = len(self._records[key])
        remaining = max(0, self.MAX_FAILURES - failures)
        return failures, remaining

    def cleanup_stale(self) -> int:
        """
        Evict all dictionary entries that carry no failures within the
        current window.  Safe to call from the background cleanup loop.

        Returns the number of keys removed.
        """
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(seconds=self.WINDOW_SECONDS)
        stale = [
            k
            for k, timestamps in list(self._records.items())
            if not any(ts > cutoff for ts in timestamps)
        ]
        for k in stale:
            del self._records[k]
        return len(stale)


#: Module-level singleton — one limiter shared across all concurrent sessions.
_pin_rl: _PinRateLimiter = _PinRateLimiter()


# ---------------------------------------------------------------------------
# Module-level PIN rate-limit helpers (used by the WS route handler)
# ---------------------------------------------------------------------------


def is_pin_rate_limited(client_ip: str, token: str) -> bool:
    """
    Return ``True`` if *client_ip* has exhausted its PIN attempts for
    *token* and must be rejected before :func:`join_session` is called.

    This pre-check prevents timing-oracle leakage: if the handler only
    checked the count *after* a join attempt, an attacker could infer a
    correct guess from the absence of a rate-limit response.
    """
    return _pin_rl.is_blocked(client_ip, token)


def record_pin_failure(client_ip: str, token: str) -> tuple[int, int]:
    """
    Record a failed creator-PIN attempt from *client_ip* on *token*.

    Returns
    -------
    (failures_in_window, remaining_attempts)
        Callers should use ``remaining_attempts`` to build the error
        message shown to the user.
    """
    return _pin_rl.record_failure(client_ip, token)


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class _Participant:
    """State for a single WebSocket connection within a chat session."""

    ws: WebSocket
    ws_id: str      # stable UUID assigned at join time — never re-uses memory addresses
    name: str
    is_creator: bool = False

    _msg_count: int = field(default=0, repr=False)
    _window_start: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc), repr=False
    )


@dataclass
class _ChatSession:
    """
    In-memory state for one Burn Chat session.

    ``participants`` is keyed by a UUID (``ws_id``) generated at join time,
    eliminating any dependence on CPython memory-address-based ``id()`` values.
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
    exclude_ws_id: Optional[str] = None,
) -> None:
    """Send *payload* to every participant, silently removing dead connections."""
    dead: list[str] = []
    for ws_id, participant in list(session.participants.items()):
        if ws_id == exclude_ws_id:
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
) -> tuple[Optional[_Participant], JoinStatus]:
    """
    Register a WebSocket connection as a participant in *token*'s session.

    Args:
        token:        Session token.
        ws:           The caller's WebSocket connection.
        display_name: Chosen display name (≤ MAX_NAME_LENGTH chars).
        pin:          Optional creator PIN.

                      *  If ``None`` or empty — join as a regular participant.
                      *  If non-empty and **correct** — join as creator
                         (``is_creator = True``).
                      *  If non-empty and **wrong** — return
                         ``(None, JoinStatus.PIN_INVALID)``; the participant
                         is **not** admitted.  The WS handler is responsible
                         for recording the failure against the rate limiter
                         and closing the connection.

    Returns:
        A 2-tuple ``(participant, status)``:

        ``(participant, JoinStatus.OK)``
            Participant was registered and the ``joined`` event was delivered.
        ``(None, JoinStatus.SESSION_NOT_FOUND)``
            Token does not map to any live session.
        ``(None, JoinStatus.SESSION_FULL)``
            The room has reached ``MAX_PARTICIPANTS``.
        ``(None, JoinStatus.PIN_INVALID)``
            A PIN was supplied but did not match.  No WebSocket message is
            sent — the caller handles error delivery and rate-limit recording.

    Security note
    -------------
    PIN comparison uses :func:`secrets.compare_digest` for constant-time
    equality to eliminate timing side-channels.  A wrong PIN is a hard
    rejection — callers must **not** silently demote the user to a regular
    participant, as that would make the creator role meaningless.

    Note:
        Messages are NOT replayed on join — true ephemeral behaviour.
        Participants only see messages that arrive after they connect.
    """
    session = get_session(token)
    if session is None:
        return None, JoinStatus.SESSION_NOT_FOUND

    if len(session.participants) >= MAX_PARTICIPANTS:
        return None, JoinStatus.SESSION_FULL

    # ── PIN authentication ─────────────────────────────────────────────────
    # If the client asserts creator identity (supplies a PIN), the PIN MUST
    # match exactly.  A wrong PIN is a hard rejection — we do not silently
    # fall back to regular-participant status, because that would make the
    # rate limiter in the WS handler ineffective (the handler only records
    # failures when this function says the PIN was wrong).
    #
    # constant-time comparison via secrets.compare_digest prevents timing
    # attacks that could otherwise reveal how many leading characters of the
    # guessed PIN were correct.
    is_creator = False
    if pin:  # pin is already normalised (stripped + uppercased) by the caller
        if not secrets.compare_digest(pin, session.creator_pin):
            return None, JoinStatus.PIN_INVALID
        is_creator = True

    # ── Register participant ────────────────────────────────────────────────
    safe_name = _safe_text(display_name, MAX_NAME_LENGTH) or "Anonymous"
    ws_id = str(uuid.uuid4())
    participant = _Participant(ws=ws, ws_id=ws_id, name=safe_name, is_creator=is_creator)
    session.participants[ws_id] = participant

    role_label = "creator" if is_creator else "participant"
    await _broadcast(
        session,
        {
            "type": "system",
            "text": f"{safe_name} joined as {role_label}",
            "participant_count": len(session.participants),
        },
        exclude_ws_id=ws_id,
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

    return participant, JoinStatus.OK


async def broadcast_message(
    token: str,
    ws_id: str,
    text: str,
) -> bool:
    """
    Broadcast a chat message from the participant identified by *ws_id*.

    Messages are NOT stored anywhere after broadcast — ephemeral by design.

    Returns:
        ``True`` if broadcast succeeded, ``False`` if the session is expired,
        the participant is no longer registered, or the rate limit is exceeded.
    """
    session = get_session(token)
    if session is None:
        return False

    participant = session.participants.get(ws_id)
    if participant is None:
        return False

    now = datetime.now(timezone.utc)
    elapsed = (now - participant._window_start).total_seconds()
    if elapsed > _RATE_WINDOW_SECS:
        participant._msg_count = 0
        participant._window_start = now

    if participant._msg_count >= _RATE_LIMIT_MSGS:
        try:
            await participant.ws.send_json(
                {
                    "type": "error",
                    "text": "Slow down — you are sending messages too quickly.",
                }
            )
        except Exception:
            pass
        return False

    participant._msg_count += 1

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

    await _broadcast(session, payload)
    return True


async def leave_session(token: str, ws_id: str) -> None:
    """
    Remove the participant identified by *ws_id* and notify remaining members.

    Safe to call even if the session is already destroyed or *ws_id* was
    never registered.
    """
    session = _SESSIONS.get(token)
    if session is None:
        return

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

    Also prunes stale PIN rate-limit entries to prevent unbounded memory
    growth in ``_pin_rl._records``.

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

    # Evict stale PIN rate-limit entries so _pin_rl._records does not grow
    # forever.  Entries with no failures inside the current window are safe
    # to discard — is_blocked() would return False for them anyway.
    pruned_keys = _pin_rl.cleanup_stale()
    if pruned_keys:
        logger.debug(
            "PIN rate-limiter: pruned %d stale key(s) from memory.", pruned_keys
        )

    return len(expired_tokens)
