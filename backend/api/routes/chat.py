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
    {"type": "send", "text": "Hello!"}
    {"type": "ping"}

Server → Client:
    {"type": "joined",     "is_creator": bool, "seconds_remaining": int, ...}
    {"type": "message",    "id": "...", "sender_name": "...", "text": "...", "sent_at": "...", "is_creator": bool}
    {"type": "countdown",  "seconds_remaining": int}
    {"type": "system",     "text": "...", "participant_count": int}
    {"type": "destroyed"}
    {"type": "error",      "text": "..."}
    {"type": "pong"}

Connection handshake
--------------------
The first message sent by the client after the WS connection is established
must be a join frame:

    {"type": "join", "display_name": "Alice", "pin": "XK3P9A"}   ← creator
    {"type": "join", "display_name": "Bob"}                        ← participant

If the join frame is malformed or the session is not found / full, the
server sends an error and closes the connection.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

from core import security
from models.schemas import ChatCreateRequest
from services import chat_service

logger = logging.getLogger(__name__)

router = APIRouter()


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

    # Basic token format guard (UUIDs are 36 chars).
    if len(token) != 36 or not all(c in "0123456789abcdef-" for c in token.lower()):
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
    1.  Accept the connection.
    2.  Wait for the client's ``{"type": "join", ...}`` handshake frame.
    3.  Register the participant (verify PIN for creator role).
    4.  Relay ``{"type": "send", "text": "..."}`` frames as broadcast messages.
    5.  Handle ``{"type": "ping"}`` keepalives.
    6.  On disconnect, remove the participant and notify others.
    7.  The background countdown task delivers ``destroyed`` events directly;
        this handler does not need to manage session expiry.

    Security
    --------
    *  Basic token format validation before any async work.
    *  The join frame must be received within 10 seconds or the connection
       is closed (prevents slow-loris style connection exhaustion).
    *  All message text is HTML-escaped inside ``chat_service.broadcast_message``.
    """
    # Basic format guard before accepting.
    if len(token) != 36 or not all(c in "0123456789abcdef-" for c in token.lower()):
        await websocket.close(code=4004, reason="Invalid session token")
        return

    await websocket.accept()

    # ── Handshake ──────────────────────────────────────────────────────────
    try:
        # Give the client 10 seconds to send the join frame.
        import asyncio as _asyncio
        try:
            raw = await _asyncio.wait_for(websocket.receive_json(), timeout=10.0)
        except _asyncio.TimeoutError:
            await websocket.send_json(
                {"type": "error", "text": "Join timeout — send {type:join} within 10 s"}
            )
            await websocket.close(code=4008, reason="Join timeout")
            return

        if not isinstance(raw, dict) or raw.get("type") != "join":
            await websocket.send_json(
                {
                    "type": "error",
                    "text": 'Expected {"type": "join", "display_name": "..."}',
                }
            )
            await websocket.close(code=4003, reason="Invalid handshake")
            return

        display_name = str(raw.get("display_name", "")).strip() or "Anonymous"
        pin = raw.get("pin")  # May be None for regular participants.

        participant = await chat_service.join_session(
            token=token,
            ws=websocket,
            display_name=display_name,
            pin=pin,
        )

        if participant is None:
            await websocket.send_json(
                {
                    "type": "error",
                    "text": "Session not found, expired, or full.",
                }
            )
            await websocket.close(code=4004, reason="Session unavailable")
            return

    except WebSocketDisconnect:
        return
    except Exception:
        logger.exception("Unexpected error during WS handshake for token=%s…", token[:8])
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
                text = str(data.get("text", "")).strip()
                if text:
                    await chat_service.broadcast_message(
                        token=token,
                        ws=websocket,
                        text=text,
                    )

            elif msg_type == "ping":
                try:
                    await websocket.send_json({"type": "pong"})
                except Exception:
                    break

    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception(
            "Unexpected error in WS message loop for token=%s…", token[:8]
        )
    finally:
        await chat_service.leave_session(token=token, ws=websocket)
