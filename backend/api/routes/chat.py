"""
Burn Chat API routes — REST + WebSocket endpoints.

Endpoints
---------
POST /chat/create          Create a new ephemeral chat session.
GET  /chat/{token}/info    Public session info (expires_at, participant count).
WS   /chat/{token}/ws      WebSocket: join room, send/receive messages.

WebSocket protocol
------------------
Client → Server (after joining):
    {"type": "send",        "text": "Hello!"}                        ← plaintext path
    {"type": "send",        "ciphertext": "<b64>", "iv": "<b64>"}   ← E2E path
    {"type": "ping"}
    {"type": "pubkey",      "public_key": "<b64-JWK>"}              ← E2E key exchange
    {"type": "session_key", "for_ws_id": "...", "wrapped_key": "<b64>"} ← creator only
    {"type": "kick",        "target_ws_id": "..."}                   ← creator only
    {"type": "lock_room",   "locked": bool}                          ← creator only
    {"type": "extend_ttl",  "extra_seconds": int}                    ← creator only

Server → Client:
    {"type": "joined",      "ws_id": "...", "is_creator": bool, "seconds_remaining": int,
                             "participant_list": [...], "locked": bool, ...}
    {"type": "message",     "id": "...", "sender_name": "...", "sent_at": "...",
                             "is_creator": bool,
                             "text": "..."              (plaintext path)
                             OR "ciphertext": "<b64>", "iv": "<b64>"  (E2E path)}
    {"type": "pubkey",      "ws_id": "...", "public_key": "<b64-JWK>"}  ← relayed to all
    {"type": "session_key", "from_ws_id": "...", "wrapped_key": "<b64>"}  ← unicast
    {"type": "countdown",   "seconds_remaining": int}
    {"type": "system",      "text": "...", "participant_count": int, "participant_list": [...]}
    {"type": "room_locked", "locked": bool}
    {"type": "ttl_extended","seconds_remaining": int, "expires_at": "..."}
    {"type": "destroyed"}
    {"type": "error",       "text": "...", "code": "..."}
    {"type": "pong"}

Connection handshake
--------------------
The first message sent by the client after the WS connection is established
must be a join frame:

    {"type": "join", "display_name": "Alice", "pin": "XK3P9A"}   ← creator
    {"type": "join", "display_name": "Bob"}                        ← participant

If the join frame is malformed or the session is not found / full, the
server sends an error and closes the connection.

PIN brute-force protection
---------------------------
Failed PIN attempts are tracked per (client_ip, session_token) pair.  After
``CHAT_PIN_MAX_FAILURES`` (default 3) failures in a ``CHAT_PIN_WINDOW_SECS``
(default 600 s) window the IP is locked out and receives close code 4029.
Configure via environment variables; see chat_service._PinRateLimiter.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

from core import security
from models.schemas import ChatCreateRequest
from services import chat_service

logger = logging.getLogger(__name__)

router = APIRouter()


def _valid_session_token(token: str) -> bool:
    """
    Return True only when *token* is a well-formed UUID v4 string.

    Rejects structurally invalid values that the previous character-set guard
    accepted: nil UUIDs, dash-only strings, wrong UUID versions, etc.
    """
    try:
        parsed = uuid.UUID(token, version=4)
        # uuid.UUID silently normalises some inputs, so round-trip the
        # canonical form to catch things like uppercase letters or extra chars.
        return str(parsed) == token
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# REST — Create session
# ---------------------------------------------------------------------------


@router.post("/chat/create")
async def create_chat_session(req: Request, body: ChatCreateRequest):
    """
    Create a new Burn Chat session.

    Returns the session token, a one-time creator PIN, and the expiry
    timestamp.  The PIN is returned **exactly once** — store it in the
    browser; it cannot be recovered if lost.

    Rate-limited to 5 sessions per IP per minute.
    """
    security.check_rate_limit(req, limit=5)

    try:
        token, pin, expires_at = chat_service.create_session(
            ttl_seconds=body.ttl_seconds
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    return JSONResponse(
        content={
            "success": True,
            "token": token,
            "creator_pin": pin,
            "expires_at": expires_at.isoformat(),
            "seconds_remaining": body.ttl_seconds,
            "share_url": f"/chat/{token}",
            "message": (
                "Session created. Share the URL with participants. "
                "Keep your creator PIN private — it is shown only once."
            ),
        },
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
    )


# ---------------------------------------------------------------------------
# REST — Session info (public, unauthenticated)
# ---------------------------------------------------------------------------


@router.get("/chat/{token}/info")
async def get_chat_info(req: Request, token: str):
    """
    Return public session metadata without requiring a PIN.

    This lets the share-link landing page display a countdown and participant
    count before the recipient connects via WebSocket.

    Rate-limited to 30 requests per IP per minute to prevent enumeration.
    """
    security.check_rate_limit(req, limit=30)

    if not _valid_session_token(token):
        raise HTTPException(status_code=404, detail="Session not found")

    info = chat_service.session_info(token)
    if info is None:
        raise HTTPException(
            status_code=410,
            detail="Session has expired or does not exist.",
        )

    return JSONResponse(
        content=info,
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
    )


# ---------------------------------------------------------------------------
# WebSocket — Real-time chat
# ---------------------------------------------------------------------------


@router.websocket("/chat/{token}/ws")
async def chat_websocket(token: str, websocket: WebSocket):
    """
    WebSocket endpoint for a Burn Chat session.

    Lifecycle
    ---------
    1.  Token format validation — cheapest guard, runs before accept.
    2.  Extract real client IP from ASGI scope.
    2.5 WS connection rate limit check — rejected before accept so no slot is consumed.
    3.  Accept the connection.
    4.  Wait for ``{"type": "join", ...}`` handshake frame (10-second timeout).
    5.  PIN rate-limit pre-check, then join_session dispatch.
    6.  Message relay loop, keepalive pong, graceful disconnect.

    Security
    --------
    *  Invalid tokens dropped before accept.
    *  Per-IP WS connection rate limit: CHAT_WS_CONNECT_LIMIT / CHAT_WS_CONNECT_WINDOW_SECS (default 10/60 s).
    *  Real client IP resolved by ProxyHeadersMiddleware before this handler runs.
    *  PIN brute-force: CHAT_PIN_MAX_FAILURES failures → close 4029.
    *  10-second join-frame timeout prevents slow-loris connection exhaustion.
    *  Message text HTML-escaped; payloads capped before allocation.
    """
    if not _valid_session_token(token):
        await websocket.close(code=4004, reason="Invalid session token")
        return

    client_ip: str = websocket.client.host if websocket.client else "unknown"

    if not security.check_ws_rate_limit(client_ip):
        await websocket.close(code=4029, reason="Connection rate limit exceeded")
        return

    await websocket.accept()

    # ── 4 – 6. Handshake ─────────────────────────────────────────────
    try:
        # ── 4. Wait for join frame (10-second timeout) ───────────────────
        try:
            raw = await asyncio.wait_for(websocket.receive_json(), timeout=10.0)
        except asyncio.TimeoutError:
            await websocket.send_json(
                {
                    "type": "error",
                    "text": "Join timeout — send {type:join} within 10 s",
                    "code": "join_timeout",
                }
            )
            await websocket.close(code=4008, reason="Join timeout")
            return

        if not isinstance(raw, dict) or raw.get("type") != "join":
            await websocket.send_json(
                {
                    "type": "error",
                    "text": 'Expected {"type": "join", "display_name": "..."}',
                    "code": "bad_handshake",
                }
            )
            await websocket.close(code=4003, reason="Invalid handshake")
            return

        raw_name = str(raw.get("display_name", ""))[: chat_service.MAX_NAME_LENGTH + 10]
        display_name = raw_name.strip() or "Anonymous"

        raw_pin: str | None = raw.get("pin") or None
        pin: str | None = None
        if raw_pin is not None:
            pin = str(raw_pin)[:20].strip().upper() or None

        if pin is not None and chat_service.is_pin_rate_limited(client_ip, token):
            logger.warning(
                "WS PIN rate-limit hit — token=%s… ip=%s (pre-join block)",
                token[:8],
                client_ip,
            )
            await websocket.send_json(
                {
                    "type": "error",
                    "text": (
                        "Too many failed PIN attempts from your IP address. "
                        "This session is locked — try again later."
                    ),
                    "code": "pin_rate_limited",
                }
            )
            await websocket.close(code=4029, reason="PIN rate limit exceeded")
            return

        # ── 6. Attempt to join ────────────────────────────────────────
        participant, status = await chat_service.join_session(
            token=token,
            ws=websocket,
            display_name=display_name,
            pin=pin,
        )

        # ── Handle join outcome ───────────────────────────────────────
        if status == chat_service.JoinStatus.PIN_INVALID:
            # Record the failure AFTER join_session returns so that only
            # genuine attempts against a real session are counted (frames
            # that fail earlier — bad format, unknown token, etc. — do not
            # consume PIN quota).
            failures, remaining = chat_service.record_pin_failure(client_ip, token)
            logger.warning(
                "Invalid creator PIN — token=%s… ip=%s failures=%d remaining=%d",
                token[:8],
                client_ip,
                failures,
                remaining,
            )
            if remaining > 0:
                error_text = (
                    f"Incorrect creator PIN. "
                    f"{remaining} attempt{'s' if remaining != 1 else ''} remaining "
                    "before your IP is locked out of this session."
                )
            else:
                error_text = (
                    "Incorrect creator PIN. "
                    "Your IP is now locked out of this session — try again later."
                )
            await websocket.send_json(
                {"type": "error", "text": error_text, "code": "pin_invalid"}
            )
            await websocket.close(code=4003, reason="Invalid PIN")
            return

        if status == chat_service.JoinStatus.LOCKED:
            await websocket.send_json(
                {
                    "type": "error",
                    "text": "This room is locked — no new participants can join.",
                    "code": "room_locked",
                }
            )
            await websocket.close(code=4003, reason="Room locked")
            return

        if status != chat_service.JoinStatus.OK:
            # SESSION_NOT_FOUND or SESSION_FULL — keep the message vague to
            # avoid leaking which condition triggered the rejection.
            await websocket.send_json(
                {
                    "type": "error",
                    "text": "Session not found, expired, or full.",
                    "code": "session_unavailable",
                }
            )
            await websocket.close(code=4004, reason="Session unavailable")
            return

        ws_id: str = participant.ws_id

    except WebSocketDisconnect:
        return
    except Exception:
        logger.exception(
            "Unexpected error during WS handshake for token=%s…", token[:8]
        )
        try:
            await websocket.close(code=4000, reason="Server error")
        except Exception:
            pass
        return

    # ── Message loop ───────────────────────────────────────────────────────
    try:
        while True:
            try:
                data = await websocket.receive_json()
            except ValueError:
                # Non-JSON frame — ignore.
                continue

            if not isinstance(data, dict):
                continue

            msg_type = data.get("type", "")

            if msg_type == "send":
                # ── Dual-path dispatch: E2E ciphertext or plaintext ──────────────
                raw_ct = data.get("ciphertext")
                raw_iv = data.get("iv")

                if raw_ct is not None:
                    # E2E path — forward opaque ciphertext; service validates format.
                    # Silently drop if iv is absent — a well-behaved client never omits it.
                    if not raw_iv:
                        continue
                    await chat_service.broadcast_message(
                        token=token,
                        ws_id=ws_id,
                        ciphertext=str(raw_ct)[: chat_service._E2E_CIPHERTEXT_MAX + 10],
                        iv=str(raw_iv)[: chat_service._E2E_IV_MAX + 10],
                    )
                else:
                    # Plaintext path — server HTML-escapes before relay.
                    raw_text = str(data.get("text", ""))[: chat_service.MAX_MESSAGE_LENGTH + 10].strip()
                    if raw_text:
                        await chat_service.broadcast_message(
                            token=token, ws_id=ws_id, text=raw_text,
                        )

            elif msg_type == "pubkey":
                # E2E key exchange — relay ECDH public key to all other participants.
                raw_key = data.get("public_key", "")
                await chat_service.relay_e2e_pubkey(
                    token=token,
                    sender_ws_id=ws_id,
                    public_key=str(raw_key),
                )

            elif msg_type == "session_key":
                # E2E key distribution — creator unicasts wrapped AES key to one peer.
                raw_for  = str(data.get("for_ws_id", "")).strip()
                raw_wkey = data.get("wrapped_key", "")
                if raw_for:
                    await chat_service.relay_e2e_session_key(
                        token=token,
                        actor_ws_id=ws_id,
                        for_ws_id=raw_for,
                        wrapped_key=str(raw_wkey),
                    )

            elif msg_type == "ping":
                try:
                    await websocket.send_json({"type": "pong"})
                except Exception:
                    break

            elif msg_type == "kick":
                target = str(data.get("target_ws_id", "")).strip()
                if target:
                    await chat_service.kick_participant(
                        token=token, actor_ws_id=ws_id, target_ws_id=target,
                    )

            elif msg_type == "lock_room":
                locked = bool(data.get("locked", True))
                await chat_service.lock_room(
                    token=token, actor_ws_id=ws_id, locked=locked,
                )

            elif msg_type == "extend_ttl":
                extra = int(data.get("extra_seconds", chat_service.MAX_EXTEND_SECONDS))
                await chat_service.extend_ttl(
                    token=token, actor_ws_id=ws_id, extra_seconds=extra,
                )

    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception(
            "Unexpected error in WS message loop for token=%s…", token[:8]
        )
    finally:
        await chat_service.leave_session(token=token, ws_id=ws_id)
