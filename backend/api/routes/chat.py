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
from fastapi.responses import HTMLResponse, JSONResponse

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
# REST — Social / OG preview page for /chat/:token links
# ---------------------------------------------------------------------------
# WhatsApp, Telegram, Twitter, Discord, Slack all use bots that fetch the
# raw HTML of a URL to generate a link preview card.  Because this app is
# a React SPA, every route serves the same index.html, which only carries
# the generic BAR OG tags (file-sharing focused).
#
# Solution: a dedicated server-side endpoint that returns a tiny HTML page
# with chat-specific OG / Twitter meta tags.
#
# Browser flow  — the page includes <meta http-equiv="refresh"> so real
# browsers are redirected to the SPA instantly (0 s delay).  Crawlers
# stop at the meta tags and never follow the refresh.
#
# Vercel rewrite (vercel.json) sends /og/chat/:token to this backend.
# The SPA's /chat/:token route remains unchanged for all real users.
# ---------------------------------------------------------------------------

_OG_SITE          = "https://bar-rnr.vercel.app"
_OG_CHAT_IMAGE    = f"{_OG_SITE}/og-chat.png"
_OG_IMAGE_ALT     = "Burn Chat — End-to-End Encrypted Ephemeral Chat | BAR Web"
_OG_SITE_NAME     = "BAR by Rolan"


def _html_escape(text: str) -> str:
    """Escape characters that are unsafe inside HTML attribute values."""
    return (
        text
        .replace("&",  "&amp;")
        .replace('"',  "&quot;")
        .replace("<",  "&lt;")
        .replace(">",  "&gt;")
    )


@router.get("/og/chat/{token}", include_in_schema=False)
async def chat_og_page(token: str):
    """
    Server-side OG / social-preview page for Burn Chat share links.

    Returns a minimal HTML document with accurate og:* and twitter:*
    meta tags so social crawlers (WhatsApp, Telegram, Twitter/X,
    Discord, Slack, iMessage, LinkedIn …) display a rich Burn Chat
    card instead of the generic BAR file-sharing defaults.

    Real browsers receive a 0-second meta-refresh redirect to the
    actual SPA route (/chat/{token}) and never notice this page.

    The endpoint is surfaced via a Vercel rewrite rule:
        /og/chat/:token  →  <backend>/og/chat/:token
    """
    if not _valid_session_token(token):
        # Malformed token — serve a generic expired card rather than
        # leaking whether the token format is wrong.
        title       = "Burn Chat — Session Unavailable | BAR Web"
        description = (
            "This Burn Chat session link is invalid or has already expired "
            "and been permanently destroyed."
        )
    else:
        info = chat_service.session_info(token)
        if info is None:
            # Valid token format but session is gone (expired / destroyed).
            title       = "Burn Chat — Session Burned | BAR Web"
            description = (
                "This Burn Chat session has already expired and been permanently "
                "destroyed. All messages were erased. No trace remains."
            )
        else:
            secs  = int(info.get("seconds_remaining", 0))
            mins  = max(1, round(secs / 60))
            count = info.get("participant_count", 0)

            plural_m = "s" if mins  != 1 else ""
            plural_p = "s" if count != 1 else ""

            title = f"Join Burn Chat — {mins} min{plural_m} remaining | BAR Web"

            participant_note = (
                f"{count} person{plural_p} already inside. "
                if count > 0 else ""
            )
            description = (
                f"You've been invited to a Burn Chat — end-to-end encrypted "
                f"ephemeral messaging that self-destructs in "
                f"{mins} minute{plural_m}. "
                f"{participant_note}"
                "No logs, no history. Messages encrypted in your browser with "
                "ECDH P-256 + AES-GCM."
            )

    # HTML-escape all dynamic values before interpolation.
    safe_title       = _html_escape(title)
    safe_description = _html_escape(description)
    canonical_url    = f"{_OG_SITE}/chat/{token}"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{safe_title}</title>

  <!-- Indexing: ephemeral session URLs must not be indexed -->
  <meta name="robots" content="noindex,nofollow">

  <!-- Canonical -->
  <link rel="canonical" href="{canonical_url}">

  <!-- Open Graph (Facebook, WhatsApp, Telegram, iMessage, Discord …) -->
  <meta property="og:type"        content="website">
  <meta property="og:url"         content="{canonical_url}">
  <meta property="og:site_name"   content="{_OG_SITE_NAME}">
  <meta property="og:title"       content="{safe_title}">
  <meta property="og:description" content="{safe_description}">
  <meta property="og:image"       content="{_OG_CHAT_IMAGE}">
  <meta property="og:image:alt"   content="{_OG_IMAGE_ALT}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <!-- Twitter / X -->
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:url"         content="{canonical_url}">
  <meta name="twitter:title"       content="{safe_title}">
  <meta name="twitter:description" content="{safe_description}">
  <meta name="twitter:image"       content="{_OG_CHAT_IMAGE}">
  <meta name="twitter:image:alt"   content="{_OG_IMAGE_ALT}">

  <!-- Instant redirect for real browsers — crawlers stop at the meta tags above -->
  <meta http-equiv="refresh" content="0;url={canonical_url}">
</head>
<body>
  <!-- Fallback for browsers that don't honour meta-refresh -->
  <p>Redirecting to Burn Chat… <a href="{canonical_url}">Click here if not redirected.</a></p>
</body>
</html>"""

    return HTMLResponse(
        content=html,
        headers={
            # Let social crawlers cache the card briefly; private because
            # the session state (remaining time, participant count) changes.
            "Cache-Control": "private, max-age=30",
        },
    )


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

        if status == chat_service.JoinStatus.CREATOR_ALREADY_CONNECTED:
            await websocket.send_json(
                {
                    "type": "error",
                    "text": "The room creator is already connected. Only one creator connection is allowed at a time.",
                    "code": "creator_already_connected",
                }
            )
            await websocket.close(code=4003, reason="Creator already connected")
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
                try:
                    extra = int(data.get("extra_seconds", chat_service.MAX_EXTEND_SECONDS))
                except (ValueError, TypeError):
                    continue
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
