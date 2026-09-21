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
import time
import json
import uuid
import inspect
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Dict, Optional, Any

from fastapi import WebSocket
from core.concurrency import track_background_task
from core.config import settings
from core import security

try:
    import redis.asyncio as aioredis
except ImportError:
    aioredis = None

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

#: Rate-limit: chat 'send' messages per window per participant.
_RATE_LIMIT_MSGS: int = 10
_RATE_WINDOW_SECS: float = 30.0

#: Rate-limit: broadcast-control messages (pubkey/kick/lock_room/extend_ttl)
#: per window per participant.  Each fans out to all participants, so a strict
#: cap stops amplification floods.  Legit rate is 1-2 per participant.
_CTRL_RATE_LIMIT_MSGS: int = 10
_CTRL_RATE_WINDOW_SECS: float = 30.0

#: Rate-limit: session_key unicasts per window per participant.  Bounded by
#: room size — a creator keys up to MAX_PARTICIPANTS-1 peers on a join burst —
#: so the cap carries headroom above the room cap to never break legit E2E
#: key distribution while still bounding a runaway sender.
_KEY_RATE_LIMIT_MSGS: int = MAX_PARTICIPANTS + 10
_KEY_RATE_WINDOW_SECS: float = 30.0

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


def _consume_rate_token(
    participant: "_Participant",
    now: datetime,
    *,
    count_attr: str,
    start_attr: str,
    limit: int,
    window_secs: float,
) -> bool:
    """Sliding-window token bucket over one of a participant's rate buckets.

    Resets the window when *window_secs* have elapsed, then returns ``True``
    and consumes one token if under *limit*, or ``False`` if the bucket is
    exhausted.  Bucket state lives in the named ``count_attr`` / ``start_attr``
    fields so several independent buckets can share this logic.
    """
    start: datetime = getattr(participant, start_attr)
    if (now - start).total_seconds() > window_secs:
        setattr(participant, count_attr, 0)
        setattr(participant, start_attr, now)

    if getattr(participant, count_attr) >= limit:
        return False

    setattr(participant, count_attr, getattr(participant, count_attr) + 1)
    return True


async def _enforce_rate(
    token: str,
    ws_id: str,
    *,
    count_attr: str,
    start_attr: str,
    limit: int,
    window_secs: float,
) -> bool:
    """Look up (token, ws_id) and consume one token from the named bucket.

    Returns ``True`` if the action is allowed.  On breach, sends a ``slow
    down`` error to the offending participant and returns ``False``.  Also
    returns ``False`` when the session or participant no longer exists.
    """
    session = get_session(token)
    if session is None:
        return False
    participant = session.participants.get(ws_id)
    if participant is None:
        return False

    allowed = _consume_rate_token(
        participant,
        datetime.now(timezone.utc),
        count_attr=count_attr,
        start_attr=start_attr,
        limit=limit,
        window_secs=window_secs,
    )
    if not allowed:
        try:
            await participant.ws.send_json(
                {"type": "error", "text": "Slow down — you are sending requests too quickly."}
            )
        except Exception:
            pass
    return allowed


async def check_control_rate(token: str, ws_id: str) -> bool:
    """Rate-gate a broadcast-control message (pubkey/kick/lock_room/extend_ttl)."""
    return await _enforce_rate(
        token,
        ws_id,
        count_attr="_ctrl_count",
        start_attr="_ctrl_window_start",
        limit=_CTRL_RATE_LIMIT_MSGS,
        window_secs=_CTRL_RATE_WINDOW_SECS,
    )


async def check_key_rate(token: str, ws_id: str) -> bool:
    """Rate-gate a session_key unicast (generous headroom for creator fanout)."""
    return await _enforce_rate(
        token,
        ws_id,
        count_attr="_key_count",
        start_attr="_key_window_start",
        limit=_KEY_RATE_LIMIT_MSGS,
        window_secs=_KEY_RATE_WINDOW_SECS,
    )


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
        sync_client = security.get_redis_client()
        if sync_client is not None:
            try:
                now_ts = time.time()
                window_start = now_ts - self.WINDOW_SECONDS
                key = f"chat:pin_fail:{client_ip}:{token}"
                sync_client.zremrangebyscore(key, "-inf", window_start)
                count = sync_client.zcard(key)
                if count is not None and count >= self.MAX_FAILURES:
                    return True
            except Exception:
                pass

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
        sync_client = security.get_redis_client()
        if sync_client is not None:
            try:
                now_ts = time.time()
                window_start = now_ts - self.WINDOW_SECONDS
                key = f"chat:pin_fail:{client_ip}:{token}"
                sync_client.zremrangebyscore(key, "-inf", window_start)
                member = f"{now_ts}:{secrets.token_hex(4)}"
                sync_client.zadd(key, {member: now_ts})
                sync_client.expire(key, int(self.WINDOW_SECONDS))
                count = sync_client.zcard(key)
                failures = count if count is not None else 1
                remaining = max(0, self.MAX_FAILURES - failures)
                return failures, remaining
            except Exception:
                pass

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
    ws_id: str              # stable UUID assigned at join time
    participant_id: str     # cryptographically secure unique participant ID (UUIDv4)
    participant_token: str  # secure token for participant auth/identity
    session_id: str         # session/room token
    display_name: str       # cosmetic display name
    name: str               # alias for display_name
    joined_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_seen: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    role: str = "participant"
    is_creator: bool = False

    # ECDH public key received via 'pubkey' message (base64 JWK).
    # Stored server-side so late-joining participants receive it in the
    # participant_list inside the 'joined' payload, avoiding the race where
    # session_key arrives before the creator's pubkey is known.
    # The server treats this as an opaque string — it is never decrypted or
    # used cryptographically by the server.
    public_key: Optional[str] = field(default=None, repr=False)

    # Chat 'send' rate bucket.
    _msg_count: int = field(default=0, repr=False)
    _window_start: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc), repr=False
    )

    # Broadcast-control rate bucket (pubkey / kick / lock_room / extend_ttl) —
    # each of these fans a message out to every participant, so a flood is a
    # DoS amplifier.  Kept separate from _msg_count so control spam cannot
    # block chat and vice-versa.
    _ctrl_count: int = field(default=0, repr=False)
    _ctrl_window_start: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc), repr=False
    )

    # session_key rate bucket — unicast (one recipient), but a creator
    # legitimately fans keys out to every peer on join bursts, so this bucket
    # has headroom sized to the room cap instead of the strict control limit.
    _key_count: int = field(default=0, repr=False)
    _key_window_start: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc), repr=False
    )


def _make_participant_list(session: _ChatSession) -> list[dict]:
    """Helper to build consistent participant_list metadata dictionaries."""
    return [
        {
            "participant_id": p.participant_id,
            "participant_token": p.participant_token,
            "ws_id": p.ws_id,
            "display_name": p.display_name,
            "name": p.display_name,
            "role": p.role,
            "is_creator": p.is_creator,
            "public_key": p.public_key,
        }
        for p in session.participants.values()
    ]


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
# Distributed Redis & In-memory Session Stores
# ---------------------------------------------------------------------------

_SESSIONS: Dict[str, _ChatSession] = {}
_async_redis_client: Optional[Any] = None
_last_async_redis_retry: float = 0.0
_ASYNC_REDIS_RETRY_INTERVAL: float = 30.0

# Active Redis Pub/Sub listener tasks per session token: token -> asyncio.Task
_PUBSUB_TASKS: Dict[str, asyncio.Task] = {}


def _is_redis_enabled() -> bool:
    """Return True if Redis is configured or an async client is explicitly set."""
    if aioredis is None:
        return False
    redis_url = getattr(settings, "redis_url", "") or os.getenv("REDIS_URL", "")
    return bool(redis_url) or _async_redis_client is not None


def _handle_async_redis_failure(e: Exception) -> None:
    """Handle a runtime async Redis operation failure by backing off and falling back."""
    global _async_redis_client, _last_async_redis_retry
    logger.warning("Async Redis operation failed (%s); falling back to in-memory chat", e)
    if aioredis is not None and isinstance(e, (aioredis.ConnectionError, aioredis.TimeoutError)):
        _async_redis_client = None
        _last_async_redis_retry = time.time()


def set_async_redis_client(client: Any) -> None:
    """Set or override the async Redis client (useful for tests or manual injection)."""
    global _async_redis_client, _last_async_redis_retry
    _async_redis_client = client
    _last_async_redis_retry = 0.0


async def get_async_redis_client() -> Optional[Any]:
    """
    Get or initialize the async Redis client.
    Returns None if Redis is not configured, not installed, or unreachable.
    Retries every 30 seconds if previously unavailable.
    """
    global _async_redis_client, _last_async_redis_retry
    if _async_redis_client is not None:
        return _async_redis_client

    if aioredis is None:
        return None

    redis_url = getattr(settings, "redis_url", "") or os.getenv("REDIS_URL", "")
    if not redis_url:
        return None

    now = time.time()
    if now - _last_async_redis_retry < _ASYNC_REDIS_RETRY_INTERVAL:
        return None

    try:
        client = aioredis.from_url(
            redis_url,
            decode_responses=True,
            socket_timeout=2.0,
            socket_connect_timeout=2.0,
        )
        await client.ping()
        _async_redis_client = client
        logger.info("Connected to Redis for distributed chat state & Pub/Sub")
        return _async_redis_client
    except Exception as exc:
        _last_async_redis_retry = now
        logger.warning(
            "Could not connect to async Redis (%s). Falling back to in-memory chat (will retry in %ds).",
            exc,
            int(_ASYNC_REDIS_RETRY_INTERVAL),
        )
        return None


async def close_async_redis_client() -> None:
    """Close the async Redis client connection pool and all Pub/Sub listeners on shutdown."""
    global _async_redis_client, _last_async_redis_retry
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        current_loop = None

    pubsub_tasks = list(_PUBSUB_TASKS.values())
    same_loop_tasks = []
    for task in pubsub_tasks:
        if not task.done():
            try:
                task_loop = task.get_loop()
                if not task_loop.is_closed():
                    if task_loop == current_loop:
                        task.cancel()
                        same_loop_tasks.append(task)
                    else:
                        task_loop.call_soon_threadsafe(task.cancel)
            except Exception:
                pass

    if same_loop_tasks and current_loop is not None:
        await asyncio.gather(*same_loop_tasks, return_exceptions=True)
    _PUBSUB_TASKS.clear()

    if _async_redis_client is not None:
        client = _async_redis_client
        _async_redis_client = None
        _last_async_redis_retry = time.time()
        try:
            aclose_fn = getattr(client, "aclose", None)
            if callable(aclose_fn):
                res = aclose_fn()
                if asyncio.iscoroutine(res) or inspect.isawaitable(res):
                    await res
            elif hasattr(client, "close"):
                res = client.close()
                if asyncio.iscoroutine(res) or inspect.isawaitable(res):
                    await res

            pool = getattr(client, "connection_pool", None)
            if pool is not None:
                pool_disconnect = getattr(pool, "disconnect", None)
                if callable(pool_disconnect):
                    res = pool_disconnect()
                    if asyncio.iscoroutine(res) or inspect.isawaitable(res):
                        await res
        except Exception as exc:
            logger.debug("Error closing async Redis client: %s", exc)


async def _get_participant_list_async(session: _ChatSession) -> list[dict]:
    """Get the global participant roster across all workers from Redis (or local session)."""
    client = await get_async_redis_client()
    if client is not None:
        try:
            raw_entries = await client.hvals(f"chat:session:{session.token}:participants")
            if raw_entries:
                return [json.loads(e) for e in raw_entries]
        except Exception:
            pass
    return _make_participant_list(session)


async def _get_participant_count_async(session: _ChatSession) -> int:
    """Get the global participant count across all workers from Redis (or local session)."""
    client = await get_async_redis_client()
    if client is not None:
        try:
            count = await client.hlen(f"chat:session:{session.token}:participants")
            return count
        except Exception:
            pass
    return len(session.participants)


# ---------------------------------------------------------------------------
# Pub/Sub Listener & Local Delivery
# ---------------------------------------------------------------------------


async def _pubsub_listener(token: str) -> None:
    """Listen to Redis Pub/Sub for room events and dispatch to local participants."""
    if not _is_redis_enabled():
        _PUBSUB_TASKS.pop(token, None)
        return

    channel = f"chat:channel:{token}"
    while True:
        session = _SESSIONS.get(token)
        if session is None or len(session.participants) == 0:
            break

        client = await get_async_redis_client()
        if client is None:
            if not _is_redis_enabled():
                break
            await asyncio.sleep(5.0)
            continue

        pubsub = client.pubsub()
        try:
            await pubsub.subscribe(channel)
            async for message in pubsub.listen():
                session = _SESSIONS.get(token)
                if session is None:
                    _PUBSUB_TASKS.pop(token, None)
                    return

                if message is None or message.get("type") != "message":
                    continue
                raw_data = message.get("data")
                if not raw_data or not isinstance(raw_data, str):
                    continue
                try:
                    data = json.loads(raw_data)
                except Exception:
                    continue

                event = data.get("event")
                if event == "broadcast":
                    payload = data.get("payload", {})
                    exclude_ws_id = data.get("exclude_ws_id")
                    await _deliver_local_broadcast(session, payload, exclude_ws_id)
                    if payload.get("type") == "destroyed":
                        for participant in list(session.participants.values()):
                            try:
                                await participant.ws.close(code=1000, reason="Session expired")
                            except Exception:
                                pass
                        session.participants.clear()
                        destroy_task = getattr(session, "_destroy_task", None)
                        if destroy_task and not destroy_task.done():
                            try:
                                if not destroy_task.get_loop().is_closed():
                                    destroy_task.cancel()
                            except (RuntimeError, Exception):
                                pass
                        _SESSIONS.pop(token, None)
                        _PUBSUB_TASKS.pop(token, None)
                        return
                    elif payload.get("type") == "room_locked":
                        session.locked = bool(payload.get("locked", True))
                    elif payload.get("type") == "ttl_extended" and "expires_at" in payload:
                        try:
                            session.expires_at = datetime.fromisoformat(payload["expires_at"])
                        except Exception:
                            pass

                elif event == "unicast":
                    target_ws_id = data.get("target_ws_id")
                    payload = data.get("payload", {})
                    target = session.participants.get(target_ws_id)
                    if target:
                        try:
                            await target.ws.send_json(payload)
                        except Exception:
                            pass

                elif event == "kick":
                    target_ws_id = data.get("target_ws_id")
                    target = session.participants.pop(target_ws_id, None)
                    if target:
                        try:
                            await target.ws.send_json(
                                {"type": "error", "text": "You have been removed by the creator.", "code": "kicked"}
                            )
                            await target.ws.close(code=4001, reason="Kicked by creator")
                        except Exception:
                            pass
                        try:
                            await client.hdel(f"chat:session:{token}:participants", target_ws_id)
                        except Exception:
                            pass

        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.debug("Pub/Sub listener error for %s: %s (reconnecting)", token[:8], exc)
            _handle_async_redis_failure(exc)
            await asyncio.sleep(0.5)
        else:
            break
        finally:
            try:
                await pubsub.unsubscribe(channel)
            except (Exception, asyncio.CancelledError):
                pass
            try:
                close_fn = getattr(pubsub, "close", None)
                if callable(close_fn):
                    res = close_fn()
                    if asyncio.iscoroutine(res) or inspect.isawaitable(res):
                        await res
            except (Exception, asyncio.CancelledError):
                pass

    _PUBSUB_TASKS.pop(token, None)


def _ensure_pubsub_listener(token: str) -> None:
    """Ensure a background Redis Pub/Sub listener is active for this session token."""
    if not _is_redis_enabled():
        return
    task = _PUBSUB_TASKS.get(token)
    if task is None or task.done():
        listener_task = asyncio.create_task(_pubsub_listener(token))
        track_background_task(listener_task)
        _PUBSUB_TASKS[token] = listener_task


async def _deliver_local_broadcast(
    session: _ChatSession,
    payload: dict,
    exclude_ws_id: Optional[str] = None,
) -> None:
    """
    Concurrently deliver a broadcast payload to connected participants on this worker.

    Enforces a strict 1.0s deadline via asyncio.wait. Any stalled connections
    are cancelled and cleaned up.
    """
    targets = [
        (ws_id, participant)
        for ws_id, participant in list(session.participants.items())
        if ws_id != exclude_ws_id
    ]
    if not targets:
        return

    async def _send(ws: WebSocket) -> None:
        await ws.send_json(payload)

    task_map = {
        asyncio.create_task(_send(p.ws)): ws_id
        for ws_id, p in targets
    }

    done, pending = await asyncio.wait(task_map.keys(), timeout=1.0)

    dead: list[str] = []
    # Cancel any broadcasts that did not finish within the 1.0s timeout
    for task in pending:
        task.cancel()
        dead.append(task_map[task])

    if pending:
        await asyncio.gather(*pending, return_exceptions=True)

    # Check for send errors in completed tasks
    for task in done:
        ws_id = task_map[task]
        try:
            task.result()
        except Exception:
            dead.append(ws_id)

    removed = [session.participants.pop(ws_id, None) for ws_id in dead]
    removed = [p for p in removed if p is not None]

    client = await get_async_redis_client()
    for p in removed:
        try:
            await p.ws.close(code=1001, reason="Broadcast timeout or connection error")
        except Exception:
            pass
        if client is not None:
            try:
                await client.hdel(f"chat:session:{session.token}:participants", p.ws_id)
            except Exception:
                pass

    if removed:
        participant_list = await _get_participant_list_async(session)
        participant_count = await _get_participant_count_async(session)
        for participant in removed:
            await _broadcast(
                session,
                {
                    "type": "system",
                    "text": f"{participant.display_name} disconnected",
                    "participant_count": participant_count,
                    "participant_list": participant_list,
                },
            )


async def _broadcast(
    session: _ChatSession,
    payload: dict,
    exclude_ws_id: Optional[str] = None,
) -> None:
    """
    Broadcast a JSON payload. If Redis is available, publishes to Redis Pub/Sub
    channel so all worker processes receive it. Otherwise falls back to local delivery.
    """
    client = await get_async_redis_client()
    if client is not None:
        try:
            msg = json.dumps({
                "event": "broadcast",
                "payload": payload,
                "exclude_ws_id": exclude_ws_id,
            })
            await client.publish(f"chat:channel:{session.token}", msg)
            return
        except Exception as exc:
            logger.warning("Redis publish failed (%s), falling back to local broadcast", exc)
            _handle_async_redis_failure(exc)

    # In-memory fallback direct delivery
    await _deliver_local_broadcast(session, payload, exclude_ws_id)


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

    1. Broadcasts ``{"type": "destroyed"}`` to all connected clients (via Pub/Sub if Redis active).
    2. Closes every WebSocket.
    3. Removes the session from Redis and ``_SESSIONS`` — GC frees the memory.

    Idempotent: calling it on an already-destroyed session is a no-op.
    """
    session = _SESSIONS.get(token)
    if session is None:
        client = await get_async_redis_client()
        if client is not None:
            try:
                await client.delete(f"chat:session:{token}")
                await client.delete(f"chat:session:{token}:participants")
                await client.zrem("chat:active_sessions", token)
                msg = json.dumps({"event": "broadcast", "payload": {"type": "destroyed"}})
                await client.publish(f"chat:channel:{token}", msg)
            except Exception:
                pass
        return

    logger.info("Destroying burn chat session %s…", token[:8])

    # Broadcast the destroy event so every client can show the burn animation.
    await _broadcast(session, {"type": "destroyed"})

    # Close all WebSocket connections.
    for participant in list(session.participants.values()):
        try:
            await participant.ws.close(code=1000, reason="Session expired")
        except Exception:
            pass

    # Cancel the countdown task if running and not self.
    destroy_task = getattr(session, "_destroy_task", None)
    if destroy_task and destroy_task != asyncio.current_task() and not destroy_task.done():
        try:
            if not destroy_task.get_loop().is_closed():
                destroy_task.cancel()
        except (RuntimeError, Exception):
            pass

    # Clean up Pub/Sub listener task
    task = _PUBSUB_TASKS.pop(token, None)
    if task and not task.done():
        try:
            task_loop = task.get_loop()
            if not task_loop.is_closed():
                if task_loop == asyncio.get_running_loop():
                    task.cancel()
                else:
                    task_loop.call_soon_threadsafe(task.cancel)
        except Exception:
            try:
                task.cancel()
            except Exception:
                pass

    # Delete from Redis
    client = await get_async_redis_client()
    if client is not None:
        try:
            await client.delete(f"chat:session:{token}")
            await client.delete(f"chat:session:{token}:participants")
            await client.zrem("chat:active_sessions", token)
        except Exception:
            pass

    # Remove from memory — this is the burn.
    _SESSIONS.pop(token, None)
    logger.info(
        "Burn chat session %s destroyed and purged from RAM.", token[:8]
    )


async def close_chat_service() -> None:
    """Cancel all active countdown tasks, Pub/Sub listeners, and clear sessions on shutdown."""
    global _async_redis_client
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        current_loop = None

    destroy_tasks = []
    current_task = None
    try:
        current_task = asyncio.current_task()
    except RuntimeError:
        pass

    for session in list(_SESSIONS.values()):
        destroy_task = getattr(session, "_destroy_task", None)
        if destroy_task and destroy_task != current_task and not destroy_task.done():
            try:
                task_loop = destroy_task.get_loop()
                if not task_loop.is_closed():
                    if task_loop == current_loop:
                        destroy_task.cancel()
                        destroy_tasks.append(destroy_task)
                    else:
                        task_loop.call_soon_threadsafe(destroy_task.cancel)
            except (RuntimeError, Exception):
                pass

    _SESSIONS.clear()
    if destroy_tasks and current_loop is not None:
        await asyncio.gather(*destroy_tasks, return_exceptions=True)

    await close_async_redis_client()


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
    sync_client = security.get_redis_client()
    if sync_client is not None:
        try:
            now_ts = time.time()
            sync_client.zremrangebyscore("chat:active_sessions", "-inf", now_ts)
            global_count = sync_client.zcard("chat:active_sessions")
            if global_count is not None and global_count >= MAX_SESSIONS:
                raise RuntimeError("Maximum concurrent chat sessions reached — try again later")
        except RuntimeError:
            raise
        except Exception:
            pass

    if len(_SESSIONS) >= MAX_SESSIONS:
        raise RuntimeError("Maximum concurrent chat sessions reached — try again later")

    token = str(uuid.uuid4())
    pin = _generate_pin()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=ttl_seconds)

    session = _ChatSession(token=token, creator_pin=pin, expires_at=expires_at, created_at=now)
    _SESSIONS[token] = session

    # Store in Redis with TTL expiration if available
    if sync_client is not None:
        try:
            sync_client.set(
                f"chat:session:{token}",
                json.dumps({
                    "token": token,
                    "creator_pin": pin,
                    "expires_at": expires_at.isoformat(),
                    "created_at": now.isoformat(),
                    "locked": False,
                }),
                ex=ttl_seconds,
            )
            sync_client.zadd("chat:active_sessions", {token: expires_at.timestamp()})
        except Exception as exc:
            logger.warning("Failed to store chat session in Redis: %s", exc)

    # Start the countdown / auto-destroy background task.
    try:
        loop = asyncio.get_running_loop()
        task = loop.create_task(_countdown_loop(token, session))
        track_background_task(task)
        session._destroy_task = task
    except RuntimeError:
        session._destroy_task = None

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

    Checks local ``_SESSIONS`` first, and queries Redis if missing to support
    multi-worker routing. Does NOT mutate state — safe to call from read paths.
    """
    session = _SESSIONS.get(token)
    now = datetime.now(timezone.utc)
    if session is not None and now >= session.expires_at:
        _SESSIONS.pop(token, None)
        return None

    # Check Redis so Worker 2 knows the session exists even if created on Worker 1
    sync_client = security.get_redis_client()
    if sync_client is not None:
        try:
            raw = sync_client.get(f"chat:session:{token}")
            if raw:
                meta = json.loads(raw)
                expires_at = datetime.fromisoformat(meta["expires_at"])
                if now >= expires_at:
                    _SESSIONS.pop(token, None)
                    return None
                created_at = datetime.fromisoformat(meta["created_at"])
                if session is None:
                    session = _ChatSession(
                        token=meta["token"],
                        creator_pin=meta["creator_pin"],
                        expires_at=expires_at,
                        created_at=created_at,
                        locked=meta.get("locked", False),
                    )
                    _SESSIONS[token] = session
                else:
                    session.locked = meta.get("locked", False)
                    session.expires_at = expires_at
                return session
            elif raw is None:
                # Session was destroyed, burned, or expired in Redis across workers
                if session is not None:
                    _SESSIONS.pop(token, None)
                return None
        except Exception:
            pass

    return session


def session_info(token: str) -> Optional[dict]:
    session = get_session(token)
    if session is None:
        return None
    now = datetime.now(timezone.utc)
    remaining = max(0, int((session.expires_at - now).total_seconds()))

    participant_count = len(session.participants)
    sync_client = security.get_redis_client()
    if sync_client is not None:
        try:
            count = sync_client.hlen(f"chat:session:{token}:participants")
            if count is not None:
                participant_count = count
        except Exception:
            pass

    return {
        "token": token,
        "expires_at": session.expires_at.isoformat(),
        "seconds_remaining": remaining,
        "participant_count": participant_count,
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

    client = await get_async_redis_client()

    # Participant count check (global)
    current_count = len(session.participants)
    if client is not None:
        try:
            current_count = await client.hlen(f"chat:session:{token}:participants")
        except Exception:
            pass

    if current_count >= MAX_PARTICIPANTS:
        return None, JoinStatus.SESSION_FULL

    # Locked rooms only admit the creator.
    is_creator = False
    if pin:
        if not secrets.compare_digest(pin, session.creator_pin):
            return None, JoinStatus.PIN_INVALID

        # Check if creator is already connected (global)
        creator_connected = any(p.is_creator for p in session.participants.values())
        if not creator_connected and client is not None:
            try:
                raw_entries = await client.hvals(f"chat:session:{token}:participants")
                for e in raw_entries:
                    p_info = json.loads(e)
                    if p_info.get("is_creator"):
                        creator_connected = True
                        break
            except Exception:
                pass

        if creator_connected:
            return None, JoinStatus.CREATOR_ALREADY_CONNECTED
        is_creator = True

    if session.locked and not is_creator:
        return None, JoinStatus.LOCKED

    safe_name = _safe_text(display_name, MAX_NAME_LENGTH) or "Anonymous"
    pid = str(uuid.uuid4())
    ptoken = secrets.token_urlsafe(32)
    role_label = "creator" if is_creator else "participant"
    now = datetime.now(timezone.utc)
    participant = _Participant(
        ws=ws,
        ws_id=pid,
        participant_id=pid,
        participant_token=ptoken,
        session_id=token,
        display_name=safe_name,
        name=safe_name,
        joined_at=now,
        last_seen=now,
        role=role_label,
        is_creator=is_creator,
    )
    session.participants[pid] = participant

    # Save to Redis hash if client available
    if client is not None:
        try:
            p_dict = {
                "participant_id": pid,
                "participant_token": ptoken,
                "ws_id": pid,
                "display_name": safe_name,
                "name": safe_name,
                "role": role_label,
                "is_creator": is_creator,
                "public_key": None,
            }
            await client.hset(f"chat:session:{token}:participants", pid, json.dumps(p_dict))
            ttl = await client.ttl(f"chat:session:{token}")
            if ttl and ttl > 0:
                await client.expire(f"chat:session:{token}:participants", ttl)
        except Exception as exc:
            logger.warning("Failed to store participant in Redis: %s", exc)

    # Start Pub/Sub listener on this worker if not already running
    _ensure_pubsub_listener(token)

    participant_list = await _get_participant_list_async(session)
    participant_count = await _get_participant_count_async(session)

    await _broadcast(
        session,
        {
            "type": "system",
            "text": f"{safe_name} joined as {role_label}",
            "participant_count": participant_count,
            "participant_list": participant_list,
        },
        exclude_ws_id=pid,
    )

    remaining = max(0, int((session.expires_at - now).total_seconds()))
    try:
        await ws.send_json(
            {
                "type": "joined",
                "participant_id": pid,
                "participant_token": ptoken,
                "ws_id": pid,           # client's own stable identity for E2E addressing
                "display_name": safe_name,
                "token": token,
                "is_creator": is_creator,
                "seconds_remaining": remaining,
                "participant_count": participant_count,
                "participant_list": participant_list,
                "locked": session.locked,
                "expires_at": session.expires_at.isoformat(),
            }
        )
    except Exception as exc:
        session.participants.pop(pid, None)
        if client is not None:
            try:
                await client.hdel(f"chat:session:{token}:participants", pid)
            except Exception:
                pass
        logger.debug("Failed to send joined confirmation to %s: %s", pid, exc)
        participant_list = await _get_participant_list_async(session)
        participant_count = await _get_participant_count_async(session)
        await _broadcast(
            session,
            {
                "type": "system",
                "text": f"{safe_name} disconnected",
                "participant_count": participant_count,
                "participant_list": participant_list,
            },
        )
        return None, JoinStatus.SESSION_NOT_FOUND

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
    if not _consume_rate_token(
        participant,
        now,
        count_attr="_msg_count",
        start_attr="_window_start",
        limit=_RATE_LIMIT_MSGS,
        window_secs=_RATE_WINDOW_SECS,
    ):
        try:
            await participant.ws.send_json(
                {"type": "error", "text": "Slow down — you are sending messages too quickly."}
            )
        except Exception:
            pass
        return False

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
            "sender_id": participant.participant_id,
            "participant_id": participant.participant_id,
            "sender_name": participant.display_name,
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
            "sender_id": participant.participant_id,
            "participant_id": participant.participant_id,
            "sender_name": participant.display_name,
            "text": safe_text,
            "sent_at": now.isoformat(),
            "is_creator": participant.is_creator,
        }

    await _broadcast(session, payload)
    return True


async def leave_session(token: str, ws_id: str) -> None:
    # Use get_session (not raw _SESSIONS.get) so an expired-but-not-yet-purged
    # session returns None here — prevents a "{name} left" broadcast racing
    # ahead of the "destroyed" event on a session that is already burning.
    session = get_session(token)
    if session is None:
        return

    participant = session.participants.pop(ws_id, None)
    client = await get_async_redis_client()

    p_name = participant.display_name if participant else None
    if client is not None:
        try:
            if not p_name:
                raw_p = await client.hget(f"chat:session:{token}:participants", ws_id)
                if raw_p:
                    p_name = json.loads(raw_p).get("display_name")
            await client.hdel(f"chat:session:{token}:participants", ws_id)
        except Exception:
            pass

    # If no more local participants on this worker, stop Pub/Sub listener
    if len(session.participants) == 0:
        task = _PUBSUB_TASKS.pop(token, None)
        if task and not task.done():
            try:
                task_loop = task.get_loop()
                if not task_loop.is_closed():
                    if task_loop == asyncio.get_running_loop():
                        task.cancel()
                    else:
                        task_loop.call_soon_threadsafe(task.cancel)
            except Exception:
                try:
                    task.cancel()
                except Exception:
                    pass

    if p_name:
        participant_list = await _get_participant_list_async(session)
        participant_count = await _get_participant_count_async(session)
        await _broadcast(
            session,
            {
                "type": "system",
                "text": f"{p_name} left",
                "participant_count": participant_count,
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
    session = get_session(token)
    if session is None:
        return False

    client = await get_async_redis_client()
    sender_exists = sender_ws_id in session.participants
    if not sender_exists and client is not None:
        try:
            sender_exists = await client.hexists(f"chat:session:{token}:participants", sender_ws_id)
        except Exception:
            pass

    if not sender_exists:
        return False

    # Validate: non-empty, strict base64, within size cap.
    key_str = str(public_key)[:_E2E_PUBKEY_MAX]
    if not key_str or not _B64_RE.match(key_str):
        return False

    # Persist the validated pubkey on the participant so late-joining peers
    # receive it in the 'joined' participant_list and can unwrap session keys
    # without waiting for a re-broadcast that may never arrive.
    if sender_ws_id in session.participants:
        session.participants[sender_ws_id].public_key = key_str

    if client is not None:
        try:
            raw_p = await client.hget(f"chat:session:{token}:participants", sender_ws_id)
            if raw_p:
                p_data = json.loads(raw_p)
                p_data["public_key"] = key_str
                await client.hset(f"chat:session:{token}:participants", sender_ws_id, json.dumps(p_data))
        except Exception:
            pass

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
    session = get_session(token)
    if session is None:
        return False

    actor = session.participants.get(actor_ws_id)
    if actor is None or not actor.is_creator:
        return False

    client = await get_async_redis_client()
    target = session.participants.get(for_ws_id)
    target_exists = target is not None
    if not target_exists and client is not None:
        try:
            target_exists = await client.hexists(f"chat:session:{token}:participants", for_ws_id)
        except Exception:
            pass

    if not target_exists:
        return False  # recipient already left

    # Validate: non-empty, base64 only, within size cap.
    key_str = str(wrapped_key)[:_E2E_WRAPPED_KEY_MAX]
    if not key_str or not _B64_RE.match(key_str):
        return False

    payload = {
        "type": "session_key",
        "from_ws_id": actor_ws_id,
        "wrapped_key": key_str,
    }

    if client is not None:
        try:
            msg = json.dumps({
                "event": "unicast",
                "target_ws_id": for_ws_id,
                "payload": payload,
            })
            await client.publish(f"chat:channel:{token}", msg)
            return True
        except Exception as exc:
            logger.warning("Redis unicast publish failed: %s", exc)

    if target is not None:
        try:
            await target.ws.send_json(payload)
            return True
        except Exception:
            return False

    return False


async def kick_participant(token: str, actor_ws_id: str, target_ws_id: str) -> bool:
    """
    Creator-only: close target's connection and remove them from the session.

    Returns True if the kick succeeded, False if preconditions were not met
    (session gone, actor is not creator, target not found, self-kick).
    """
    session = get_session(token)
    if session is None:
        return False

    actor = session.participants.get(actor_ws_id)
    if actor is None or not actor.is_creator:
        return False

    if target_ws_id == actor_ws_id:
        return False  # no self-kick

    client = await get_async_redis_client()
    target = session.participants.pop(target_ws_id, None)
    target_name = target.display_name if target else None

    if target is None and client is not None:
        try:
            raw_p = await client.hget(f"chat:session:{token}:participants", target_ws_id)
            if raw_p:
                p_data = json.loads(raw_p)
                target_name = p_data.get("display_name", "Participant")
                await client.hdel(f"chat:session:{token}:participants", target_ws_id)
        except Exception:
            pass

    if target is None and target_name is None:
        return False

    if target is not None:
        try:
            await target.ws.send_json(
                {"type": "error", "text": "You have been removed by the creator.", "code": "kicked"}
            )
            await target.ws.close(code=4001, reason="Kicked by creator")
        except Exception:
            pass
        if client is not None:
            try:
                await client.hdel(f"chat:session:{token}:participants", target_ws_id)
            except Exception:
                pass

    if client is not None:
        try:
            msg = json.dumps({
                "event": "kick",
                "target_ws_id": target_ws_id,
            })
            await client.publish(f"chat:channel:{token}", msg)
        except Exception:
            pass

    participant_list = await _get_participant_list_async(session)
    participant_count = await _get_participant_count_async(session)
    await _broadcast(
        session,
        {
            "type": "system",
            "text": f"{target_name or 'Participant'} was removed by the creator",
            "participant_count": participant_count,
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
    session = get_session(token)
    if session is None:
        return False

    actor = session.participants.get(actor_ws_id)
    if actor is None or not actor.is_creator:
        return False

    session.locked = locked

    client = await get_async_redis_client()
    if client is not None:
        try:
            raw = await client.get(f"chat:session:{token}")
            if raw:
                meta = json.loads(raw)
                meta["locked"] = locked
                ttl = await client.ttl(f"chat:session:{token}")
                ex = ttl if ttl and ttl > 0 else None
                await client.set(f"chat:session:{token}", json.dumps(meta), ex=ex)
        except Exception as exc:
            logger.warning("Failed to update locked state in Redis: %s", exc)

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
    session = get_session(token)
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

    client = await get_async_redis_client()
    if client is not None:
        try:
            raw = await client.get(f"chat:session:{token}")
            if raw:
                meta = json.loads(raw)
                meta["expires_at"] = new_expiry.isoformat()
                await client.set(f"chat:session:{token}", json.dumps(meta), ex=remaining)
            await client.expire(f"chat:session:{token}:participants", remaining)
        except Exception as exc:
            logger.warning("Failed to update TTL in Redis: %s", exc)

    await _broadcast(
        session,
        {"type": "ttl_extended", "seconds_remaining": remaining, "expires_at": session.expires_at.isoformat()},
    )
    return True


# ---------------------------------------------------------------------------
# Safety-net cleanup (called by services/cleanup.py)
# ---------------------------------------------------------------------------


async def cleanup_expired_sessions() -> int:
    """
    Async safety-net: destroy sessions whose TTL has elapsed but whose
    background destroy task may have crashed.

    Routes each expired session through ``_destroy_session`` so connected
    clients still receive ``{"type": "destroyed"}`` and show the burn
    animation, instead of dying silently when the countdown task crashes.

    Also prunes stale PIN rate-limit entries to prevent unbounded memory
    growth in ``_pin_rl._records``.

    Returns the number of sessions purged.
    """
    now = datetime.now(timezone.utc)
    expired_tokens = [
        t for t, s in list(_SESSIONS.items()) if now >= s.expires_at
    ]
    for token in expired_tokens:
        # Cancel the (crashed or stalled) background task first so it cannot
        # race with the destroy we are about to run.
        session = _SESSIONS.get(token)
        if session and session._destroy_task and not session._destroy_task.done():
            session._destroy_task.cancel()
        logger.warning(
            "Safety-net cleanup: destroying stale chat session %s", token[:8]
        )
        # Broadcast 'destroyed' + close WebSockets + purge from _SESSIONS.
        await _destroy_session(token)

    # Evict stale PIN rate-limit entries so _pin_rl._records does not grow
    # forever.  Entries with no failures inside the current window are safe
    # to discard — is_blocked() would return False for them anyway.
    pruned_keys = _pin_rl.cleanup_stale()
    if pruned_keys:
        logger.debug(
            "PIN rate-limiter: pruned %d stale key(s) from memory.", pruned_keys
        )

    return len(expired_tokens)
