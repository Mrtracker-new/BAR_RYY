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
import re
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

#: Maximum time (seconds) the creator can add per extend_ttl call.
MAX_EXTEND_SECONDS: int = 30 * 60  # 30 minutes

#: Maximum number of concurrent sessions server-wide.
MAX_SESSIONS: int = max(1, int(os.getenv("MAX_CHAT_SESSIONS", "500")))

#: Maximum concurrent WebSocket connections per session.
MAX_PARTICIPANTS: int = 50

#: Maximum characters per message.
MAX_MESSAGE_LENGTH: int = 2_000

#: Maximum display-name length.
MAX_NAME_LENGTH: int = 30

# ---------------------------------------------------------------------------
# E2E relay limits  (server never inspects payload content)
# ---------------------------------------------------------------------------

#: Maximum base64 length of an ECDH public key (JWK ≈ 200 chars; 512 is generous).
_E2E_PUBKEY_MAX: int = 512

#: Maximum base64 length of a wrapped AES session key (32 raw bytes → 44 b64 chars;
#: 512 leaves ample room for future algorithm changes).
_E2E_WRAPPED_KEY_MAX: int = 512

#: Maximum base64 length of an AES-GCM ciphertext for a 2 000-char plaintext
#: (≈ 2 667 b64 chars + padding).  4 096 is a safe ceiling.
_E2E_CIPHERTEXT_MAX: int = 4_096

#: AES-GCM IV is always 12 raw bytes → 16 base64 chars.  Allow 32 for padding.
_E2E_IV_MAX: int = 32

#: Pre-compiled pattern — strict standard base64 (RFC 4648 §4).
#: Accepts 0–2 padding chars at the end only; body must be [A-Za-z0-9+/].
#: The length-modulo-4 constraint is NOT enforced by regex alone but the
#: slicing done before this check already bounds the input, and any
#: base64url characters (‘-’ / ‘_’) are rejected here — our client emits
#: standard base64 via btoa().
_B64_RE: re.Pattern = re.compile(r'^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})?$')

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
    """Truncate *raw* to *max_len* characters.

    No HTML-escaping is applied — output is serialised as JSON and rendered
    by React JSX text nodes, which inherently prevent XSS.
    """
    return raw[:max_len]


# ---------------------------------------------------------------------------
# Join result type
# ---------------------------------------------------------------------------


class JoinStatus(str, Enum):
    OK               = "ok"
    SESSION_NOT_FOUND = "session_not_found"
    SESSION_FULL     = "session_full"
    LOCKED           = "locked"
    PIN_INVALID      = "pin_invalid"
    CREATOR_ALREADY_CONNECTED = "creator_already_connected"


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

    # ECDH public key received via 'pubkey' message (base64 JWK).
    # Stored server-side so late-joining participants receive it in the
    # participant_list inside the 'joined' payload, avoiding the race where
    # session_key arrives before the creator's pubkey is known.
    # The server treats this as an opaque string — it is never decrypted or
    # used cryptographically by the server.
    public_key: Optional[str] = field(default=None, repr=False)

    _msg_count: int = field(default=0, repr=False)
    _window_start: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc), repr=False
    )


@dataclass
class _ChatSession:
    token: str
    creator_pin: str
    expires_at: datetime
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    participants: Dict[str, _Participant] = field(default_factory=dict)
    locked: bool = False
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

    Remaining time is always computed from ``session.expires_at - now`` so
    that event-loop contention and GC pauses do not accumulate into drift.

    The sleep floor of 0.05 s prevents a tight spin loop in the degenerate
    case where ``remaining`` drifts to a positive value smaller than the
    normal interval (e.g. after a GC pause in the last 1-second tick).

    Calls ``_destroy_session`` when the TTL expires.
    """
    try:
        while True:
            now = datetime.now(timezone.utc)
            remaining = (session.expires_at - now).total_seconds()

            if remaining <= 0:
                break

            interval = 1.0 if remaining <= 60 else 10.0
            sleep_for = max(0.05, min(interval, remaining))
            await asyncio.sleep(sleep_for)

            # Always recompute from the wall clock — never trust accumulated sleep time.
            remaining = (session.expires_at - datetime.now(timezone.utc)).total_seconds()

            await _broadcast(
                session,
                {"type": "countdown", "seconds_remaining": max(0, int(remaining))},
            )

            if remaining <= 0:
                break

    except asyncio.CancelledError:
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
        "locked": session.locked,
        "created_at": session.created_at.isoformat(),
    }


async def join_session(
    token: str,
    ws: WebSocket,
    display_name: str,
    pin: Optional[str] = None,
) -> tuple[Optional[_Participant], JoinStatus]:
    session = get_session(token)
    if session is None:
        return None, JoinStatus.SESSION_NOT_FOUND

    if len(session.participants) >= MAX_PARTICIPANTS:
        return None, JoinStatus.SESSION_FULL

    # Locked rooms only admit the creator.
    is_creator = False
    if pin:
        if not secrets.compare_digest(pin, session.creator_pin):
            return None, JoinStatus.PIN_INVALID
        # Reject if another creator is already connected — allowing two
        # creators would cause each to generate an independent E2E session
        # key, splitting participants into incompatible encryption groups.
        if any(p.is_creator for p in session.participants.values()):
            return None, JoinStatus.CREATOR_ALREADY_CONNECTED
        is_creator = True

    if session.locked and not is_creator:
        return None, JoinStatus.LOCKED

    safe_name = _safe_text(display_name, MAX_NAME_LENGTH) or "Anonymous"
    ws_id = str(uuid.uuid4())
    participant = _Participant(ws=ws, ws_id=ws_id, name=safe_name, is_creator=is_creator)
    session.participants[ws_id] = participant

    role_label = "creator" if is_creator else "participant"
    participant_list = [
        {
            "ws_id": p.ws_id,
            "name": p.name,
            "is_creator": p.is_creator,
            # Include each participant's ECDH public key if available.
            # Participants who have not yet sent a 'pubkey' message will have
            # None here — the client ignores null public_key entries gracefully.
            "public_key": p.public_key,
        }
        for p in session.participants.values()
    ]
    await _broadcast(
        session,
        {
            "type": "system",
            "text": f"{safe_name} joined as {role_label}",
            "participant_count": len(session.participants),
            "participant_list": participant_list,
        },
        exclude_ws_id=ws_id,
    )

    now = datetime.now(timezone.utc)
    remaining = max(0, int((session.expires_at - now).total_seconds()))
    await ws.send_json(
        {
            "type": "joined",
            "ws_id": ws_id,           # client's own stable identity for E2E addressing
            "token": token,
            "is_creator": is_creator,
            "seconds_remaining": remaining,
            "participant_count": len(session.participants),
            "participant_list": participant_list,
            "locked": session.locked,
            "expires_at": session.expires_at.isoformat(),
        }
    )

    return participant, JoinStatus.OK


async def broadcast_message(
    token: str,
    ws_id: str,
    *,
    text: Optional[str] = None,
    ciphertext: Optional[str] = None,
    iv: Optional[str] = None,
) -> bool:
    """
    Broadcast a chat message from the participant identified by *ws_id*.

    Supports two mutually exclusive paths:

    Plaintext path  (``text`` supplied)
        Server HTML-escapes and length-caps the content before relaying.
        Used when E2E is not active.

    E2E path  (``ciphertext`` + ``iv`` supplied)
        Server validates only that both fields are non-empty base64 strings
        within size limits, then relays the opaque payload as-is.
        **No html.escape() is applied** — ciphertext is binary-safe base64.
        The server never reads the plaintext.

    Rate limiting applies on both paths (message *frequency*, not content).

    Returns:
        ``True``  — message relayed successfully.
        ``False`` — session gone, participant not found, or rate limit hit.

    Raises:
        ValueError — both or neither of (text / ciphertext+iv) are supplied.
    """
    # ── Argument validation ────────────────────────────────────────────────
    e2e_mode = ciphertext is not None
    if e2e_mode:
        if iv is None:
            raise ValueError("iv is required when ciphertext is supplied")
        if text is not None:
            raise ValueError("text and ciphertext are mutually exclusive")
    elif text is None:
        raise ValueError("Either text or ciphertext+iv must be supplied")

    # ── Session / participant lookup ───────────────────────────────────────
    session = get_session(token)
    if session is None:
        return False

    participant = session.participants.get(ws_id)
    if participant is None:
        return False

    # ── Per-participant rate limit (applies to both paths) ─────────────────
    now = datetime.now(timezone.utc)
    elapsed = (now - participant._window_start).total_seconds()
    if elapsed > _RATE_WINDOW_SECS:
        participant._msg_count = 0
        participant._window_start = now

    if participant._msg_count >= _RATE_LIMIT_MSGS:
        try:
            await participant.ws.send_json(
                {"type": "error", "text": "Slow down — you are sending messages too quickly."}
            )
        except Exception:
            pass
        return False

    participant._msg_count += 1

    # ── Build payload ──────────────────────────────────────────────────────
    if e2e_mode:
        # Size-cap and base64 format check — content is never inspected.
        ct = str(ciphertext)[:_E2E_CIPHERTEXT_MAX]
        nonce = str(iv)[:_E2E_IV_MAX]
        if not ct or not _B64_RE.match(ct):
            return False
        if not nonce or not _B64_RE.match(nonce):
            return False

        payload = {
            "type": "message",
            "id": str(uuid.uuid4()),
            "sender_name": participant.name,
            "sent_at": now.isoformat(),
            "is_creator": participant.is_creator,
            # E2E fields — opaque to the server.
            "ciphertext": ct,
            "iv": nonce,
        }
    else:
        safe_text = _safe_text(str(text), MAX_MESSAGE_LENGTH)
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
    session = _SESSIONS.get(token)
    if session is None:
        return

    participant = session.participants.pop(ws_id, None)
    if participant:
        participant_list = [
            {"ws_id": p.ws_id, "name": p.name, "is_creator": p.is_creator}
            for p in session.participants.values()
        ]
        await _broadcast(
            session,
            {
                "type": "system",
                "text": f"{participant.name} left",
                "participant_count": len(session.participants),
                "participant_list": participant_list,
            },
        )


async def relay_e2e_pubkey(
    token: str,
    sender_ws_id: str,
    public_key: str,
) -> bool:
    """
    Broadcast an ECDH public key from *sender_ws_id* to all other participants.

    The server performs **no cryptographic operations** — it validates only
    that *public_key* is a non-empty base64 string within the size limit and
    that the sender is an active participant.  Key content is never inspected.

    This is intentionally dumb relay: the server could equally be delivering
    a bogus key (MITM scenario), which is why clients display a session
    fingerprint for out-of-band verification.

    Returns True if relayed, False if session/participant not found or key
    fails format validation.
    """
    session = _SESSIONS.get(token)
    if session is None:
        return False

    if sender_ws_id not in session.participants:
        return False

    # Validate: non-empty, strict base64, within size cap.
    key_str = str(public_key)[:_E2E_PUBKEY_MAX]
    if not key_str or not _B64_RE.match(key_str):
        return False

    # Persist the validated pubkey on the participant so late-joining peers
    # receive it in the 'joined' participant_list and can unwrap session keys
    # without waiting for a re-broadcast that may never arrive.
    session.participants[sender_ws_id].public_key = key_str

    await _broadcast(
        session,
        {"type": "pubkey", "ws_id": sender_ws_id, "public_key": key_str},
        exclude_ws_id=sender_ws_id,
    )
    return True


async def relay_e2e_session_key(
    token: str,
    actor_ws_id: str,
    for_ws_id: str,
    wrapped_key: str,
) -> bool:
    """
    Unicast a wrapped AES session key from the creator to a single recipient.

    Only the session creator (*actor_ws_id* with ``is_creator=True``) may
    call this.  The wrapped key is an opaque base64 blob produced by the
    creator's browser (AES-KW over the ECDH-derived per-pair secret) and
    is never inspected or stored by the server.

    Returns True if delivered, False on any precondition failure.
    """
    session = _SESSIONS.get(token)
    if session is None:
        return False

    actor = session.participants.get(actor_ws_id)
    if actor is None or not actor.is_creator:
        return False

    target = session.participants.get(for_ws_id)
    if target is None:
        return False  # recipient already left

    # Validate: non-empty, base64 only, within size cap.
    key_str = str(wrapped_key)[:_E2E_WRAPPED_KEY_MAX]
    if not key_str or not _B64_RE.match(key_str):
        return False

    try:
        await target.ws.send_json(
            {
                "type": "session_key",
                "from_ws_id": actor_ws_id,
                "wrapped_key": key_str,
            }
        )
    except Exception:
        return False

    return True


async def kick_participant(token: str, actor_ws_id: str, target_ws_id: str) -> bool:
    """
    Creator-only: close target's connection and remove them from the session.

    Returns True if the kick succeeded, False if preconditions were not met
    (session gone, actor is not creator, target not found, self-kick).
    """
    session = _SESSIONS.get(token)
    if session is None:
        return False

    actor = session.participants.get(actor_ws_id)
    if actor is None or not actor.is_creator:
        return False

    if target_ws_id == actor_ws_id:
        return False  # no self-kick

    target = session.participants.pop(target_ws_id, None)
    if target is None:
        return False

    try:
        await target.ws.send_json(
            {"type": "error", "text": "You have been removed by the creator.", "code": "kicked"}
        )
        await target.ws.close(code=4001, reason="Kicked by creator")
    except Exception:
        pass

    participant_list = [
        {"ws_id": p.ws_id, "name": p.name, "is_creator": p.is_creator}
        for p in session.participants.values()
    ]
    await _broadcast(
        session,
        {
            "type": "system",
            "text": f"{target.name} was removed by the creator",
            "participant_count": len(session.participants),
            "participant_list": participant_list,
        },
    )
    return True


async def lock_room(token: str, actor_ws_id: str, locked: bool) -> bool:
    """
    Creator-only: set the room's locked state.

    When locked=True, new non-creator participants cannot join.
    Returns True if the state was applied, False on precondition failure.
    """
    session = _SESSIONS.get(token)
    if session is None:
        return False

    actor = session.participants.get(actor_ws_id)
    if actor is None or not actor.is_creator:
        return False

    session.locked = locked
    await _broadcast(
        session,
        {"type": "room_locked", "locked": locked},
    )
    return True


async def extend_ttl(token: str, actor_ws_id: str, extra_seconds: int) -> bool:
    """
    Creator-only: extend the session TTL by up to MAX_EXTEND_SECONDS.

    The new expiry is capped at created_at + MAX_TTL_SECONDS so the
    absolute session limit cannot be circumvented by repeated extensions.
    Returns True if extended, False on precondition failure.
    """
    session = _SESSIONS.get(token)
    if session is None:
        return False

    actor = session.participants.get(actor_ws_id)
    if actor is None or not actor.is_creator:
        return False

    extra = max(0, min(int(extra_seconds), MAX_EXTEND_SECONDS))
    if extra == 0:
        return False

    hard_cap = session.created_at + timedelta(seconds=MAX_TTL_SECONDS)
    new_expiry = min(session.expires_at + timedelta(seconds=extra), hard_cap)
    if new_expiry <= session.expires_at:
        return False  # already at the cap

    session.expires_at = new_expiry
    now = datetime.now(timezone.utc)
    remaining = max(0, int((session.expires_at - now).total_seconds()))
    await _broadcast(
        session,
        {"type": "ttl_extended", "seconds_remaining": remaining, "expires_at": session.expires_at.isoformat()},
    )
    return True


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
