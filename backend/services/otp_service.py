"""
OTP (One-Time Password) Service for Two-Factor Authentication
Supports email-based OTP verification via Brevo Transactional Email REST API.

Design principles
-----------------
* Fully async — uses httpx.AsyncClient so we never block the event loop
  (the old sib-api-v3-sdk was synchronous and blocked the uvicorn event loop,
  causing emails to stall / time out silently).
* Lazy credential validation — env vars are read inside the first call, not at
  import time, so load_dotenv() in app.py always runs first.
* Exponential-backoff retry — transient 5xx / network errors are retried up to
  3 times so a momentary Brevo blip does not silently drop the email.
* Constant-time OTP comparison — hmac.compare_digest prevents timing attacks.
* Secure OTP generation — secrets module (CSPRNG), not random (Mersenne Twister).
"""

import os
import hmac
import asyncio
import hashlib
import secrets
import logging
import traceback
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# OTP Configuration
# ---------------------------------------------------------------------------
OTP_LENGTH = 6
OTP_EXPIRY_MINUTES = 10
MAX_OTP_ATTEMPTS = 3

# Brevo transactional-email REST endpoint (v3)
BREVO_SMTP_URL = "https://api.brevo.com/v3/smtp/email"

# Retry policy for transient network / server errors
_MAX_RETRIES = 3
_RETRY_BACKOFF_BASE = 0.5  # seconds; doubles on each retry


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_brevo_credentials() -> tuple[str, str, str]:
    """
    Read Brevo credentials from the environment at call time (not import time)
    so that load_dotenv() in app.py has already populated os.environ.

    Returns (api_key, from_email, from_name).
    Raises RuntimeError with a clear message if any required value is missing.
    """
    api_key = os.getenv("BREVO_API_KEY", "").strip()
    from_email = os.getenv("FROM_EMAIL", "").strip()
    from_name = os.getenv("FROM_NAME", "BAR Web - Secure File Sharing").strip()

    missing: list[str] = []
    if not api_key:
        missing.append("BREVO_API_KEY")
    if not from_email:
        missing.append("FROM_EMAIL")

    if missing:
        raise RuntimeError(
            f"Email service misconfigured — missing env vars: {', '.join(missing)}. "
            "Set them in your .env (local) or Render dashboard (production)."
        )

    return api_key, from_email, from_name


async def _send_with_retry(
    payload: dict,
    api_key: str,
    *,
    max_retries: int = _MAX_RETRIES,
    backoff_base: float = _RETRY_BACKOFF_BASE,
) -> httpx.Response:
    """
    POST *payload* to the Brevo REST API with exponential-backoff retry.

    Retries on:
      * httpx network-level errors (connection refused, timeout, …)
      * HTTP 5xx responses from Brevo (transient server errors)

    Does NOT retry on 4xx (bad request / auth failure — fix the payload/key).
    """
    headers = {
        "api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    last_exc: Optional[Exception] = None
    last_response: Optional[httpx.Response] = None

    async with httpx.AsyncClient(timeout=15.0) as client:
        for attempt in range(1, max_retries + 1):
            try:
                response = await client.post(BREVO_SMTP_URL, json=payload, headers=headers)
                last_response = response

                if response.status_code < 500:
                    # 2xx = success; 4xx = caller error — don't retry either
                    return response

                # 5xx → Brevo-side transient error; retry
                logger.warning(
                    "Brevo returned %s on attempt %d/%d — %s",
                    response.status_code, attempt, max_retries, response.text,
                )

            except httpx.TransportError as exc:
                last_exc = exc
                logger.warning(
                    "Network error on attempt %d/%d: %s", attempt, max_retries, exc
                )

            if attempt < max_retries:
                wait = backoff_base * (2 ** (attempt - 1))
                logger.info("Retrying in %.1fs…", wait)
                await asyncio.sleep(wait)

    # All retries exhausted
    if last_response is not None:
        return last_response
    raise last_exc or RuntimeError("All Brevo send attempts failed with network errors.")


# ---------------------------------------------------------------------------
# OTPService
# ---------------------------------------------------------------------------

class OTPService:
    """Handles OTP generation, in-memory storage, validation, and delivery."""

    def __init__(self) -> None:
        # token → session dict
        self.otp_storage: Dict[str, Dict[str, Any]] = {}

    # ------------------------------------------------------------------
    # Generation
    # ------------------------------------------------------------------

    def generate_otp(self) -> str:
        """
        Generate a cryptographically secure random numeric OTP.

        Uses ``secrets.randbelow`` (os.urandom / CSPRNG) — NOT
        Python's Mersenne-Twister ``random`` module (CWE-338).
        """
        return "".join(str(secrets.randbelow(10)) for _ in range(OTP_LENGTH))

    # ------------------------------------------------------------------
    # Session management
    # ------------------------------------------------------------------

    def create_otp_session(self, token: str, email: str) -> str:
        """Create (or replace) an OTP session for *token*. Returns the OTP code."""
        otp_code = self.generate_otp()
        otp_hash = hashlib.sha256(otp_code.encode()).hexdigest()

        self.otp_storage[token] = {
            "otp_hash": otp_hash,
            "email": email,
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES),
            "attempts": 0,
            "verified": False,
        }

        logger.info("OTP session created for token %.8s… (expires in %d min)", token, OTP_EXPIRY_MINUTES)
        return otp_code

    def verify_otp(self, token: str, otp_code: str) -> tuple[bool, str]:
        """
        Verify *otp_code* for *token*.
        Returns (is_valid, error_message).
        """
        if token not in self.otp_storage:
            return False, "OTP session not found. Please request a new OTP."

        session = self.otp_storage[token]

        if session["verified"]:
            return False, "OTP already used. Please request a new OTP."

        if datetime.now(timezone.utc) > session["expires_at"]:
            del self.otp_storage[token]
            return False, "OTP has expired. Please request a new OTP."

        if session["attempts"] >= MAX_OTP_ATTEMPTS:
            del self.otp_storage[token]
            return False, (
                f"Maximum OTP attempts ({MAX_OTP_ATTEMPTS}) exceeded. "
                "Please request a new OTP."
            )

        session["attempts"] += 1

        # Constant-time comparison — prevents timing side-channel (CWE-208)
        provided_hash = hashlib.sha256(otp_code.encode()).hexdigest()
        if hmac.compare_digest(provided_hash, session["otp_hash"]):
            session["verified"] = True
            logger.info("OTP verified for token %.8s…", token)
            return True, ""

        remaining = MAX_OTP_ATTEMPTS - session["attempts"]
        return False, f"Invalid OTP code. {remaining} attempt(s) remaining."

    def is_verified(self, token: str) -> bool:
        """Return True if *token* has a live, verified OTP session."""
        return self.otp_storage.get(token, {}).get("verified", False)

    def clear_verification(self, token: str) -> None:
        """Remove the OTP session for *token* after successful file access."""
        if token in self.otp_storage:
            del self.otp_storage[token]
            logger.info("OTP verification cleared for token %.8s…", token)

    def cleanup_expired_otps(self) -> None:
        """Prune stale OTP sessions (called by the background cleanup loop)."""
        now = datetime.now(timezone.utc)
        expired = [t for t, s in self.otp_storage.items() if now > s["expires_at"]]
        for t in expired:
            del self.otp_storage[t]
        if expired:
            logger.info("Cleaned up %d expired OTP session(s).", len(expired))

    # ------------------------------------------------------------------
    # Email delivery  (fully async — never blocks the event loop)
    # ------------------------------------------------------------------

    async def send_otp_email(
        self, email: str, otp_code: str, filename: str
    ) -> tuple[bool, str]:
        """
        Send *otp_code* to *email* via the Brevo transactional-email REST API.

        This method is **async** and uses httpx.AsyncClient so it never blocks
        the uvicorn event loop (unlike the old sib-api-v3-sdk which was
        synchronous and caused silent email timeouts).

        Returns (success: bool, error_message: str).
        """
        # --- credential validation (lazy — env is definitely loaded by now) --
        try:
            api_key, from_email, from_name = _get_brevo_credentials()
        except RuntimeError as exc:
            logger.error("Email service not configured: %s", exc)
            return False, str(exc)

        # --- build HTML body ------------------------------------------------
        html_body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BAR Web — One-Time Password</title>
  <style>
    body {{ margin: 0; padding: 0; background: #0d0d0d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #e0e0e0; }}
    .wrapper {{ max-width: 560px; margin: 40px auto; padding: 0 16px; }}
    .card {{ background: #181818; border: 1px solid #2a2a2a; border-radius: 12px; overflow: hidden; }}
    .header {{ background: linear-gradient(135deg, #1a1a1a 0%, #111 100%); border-bottom: 1px solid #2a2a2a; padding: 32px; text-align: center; }}
    .header h1 {{ margin: 0; font-size: 20px; font-weight: 600; color: #fff; letter-spacing: -0.3px; }}
    .header p {{ margin: 6px 0 0; font-size: 13px; color: #666; }}
    .body {{ padding: 32px; }}
    .body p {{ margin: 0 0 16px; font-size: 14px; color: #aaa; line-height: 1.6; }}
    .body strong {{ color: #e0e0e0; }}
    .otp-block {{ background: #0d0d0d; border: 1px dashed #333; border-radius: 10px; padding: 28px 16px; text-align: center; margin: 24px 0; }}
    .otp-block .otp {{ font-size: 40px; font-weight: 700; letter-spacing: 14px; color: #fff; font-feature-settings: "tnum"; font-variant-numeric: tabular-nums; }}
    .otp-block .hint {{ font-size: 12px; color: #555; margin-top: 8px; }}
    .notice {{ background: #1a1500; border: 1px solid #3a2f00; border-radius: 8px; padding: 14px 16px; margin-top: 4px; }}
    .notice ul {{ margin: 8px 0 0; padding-left: 18px; }}
    .notice li {{ font-size: 13px; color: #aaa; margin-bottom: 4px; }}
    .footer {{ border-top: 1px solid #2a2a2a; padding: 20px 32px; text-align: center; }}
    .footer p {{ margin: 0; font-size: 11px; color: #444; }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1>🔐 Two-Factor Authentication</h1>
        <p>BAR Web — Burn After Reading</p>
      </div>
      <div class="body">
        <p>Someone is attempting to access a protected file:</p>
        <p><strong>{filename}</strong></p>
        <p>Use the one-time password below to verify access:</p>
        <div class="otp-block">
          <div class="otp">{otp_code}</div>
          <div class="hint">Enter this code exactly as shown</div>
        </div>
        <div class="notice">
          <strong style="color:#e0b800;">⚠ Important</strong>
          <ul>
            <li>Code expires in <strong style="color:#e0e0e0;">{OTP_EXPIRY_MINUTES} minutes</strong></li>
            <li>You have <strong style="color:#e0e0e0;">{MAX_OTP_ATTEMPTS} attempts</strong> to enter it correctly</li>
            <li>Do not share this code with anyone</li>
          </ul>
        </div>
        <p style="margin-top:24px;">If you did not request this, you can safely ignore this email.</p>
      </div>
      <div class="footer">
        <p>BAR Web · Secure File Sharing · This is an automated message — do not reply.</p>
      </div>
    </div>
  </div>
</body>
</html>"""

        payload = {
            "sender": {"name": from_name, "email": from_email},
            "to": [{"email": email}],
            "subject": "Your One-Time Password - BAR Web",
            "htmlContent": html_body,
        }

        logger.info("Sending OTP email to %s via Brevo REST API…", email)

        try:
            response = await _send_with_retry(payload, api_key)
        except Exception as exc:
            error_msg = f"Network error sending OTP email: {exc}"
            logger.error("%s\n%s", error_msg, traceback.format_exc())
            return False, error_msg

        if response.status_code in (200, 201):
            try:
                msg_id = response.json().get("messageId", "n/a")
            except Exception:
                msg_id = "n/a"
            logger.info("OTP email sent successfully to %s (messageId=%s)", email, msg_id)
            return True, ""

        # Non-2xx response
        error_msg = (
            f"Brevo API error {response.status_code}: {response.text[:400]}"
        )
        logger.error("Failed to send OTP email: %s", error_msg)
        return False, error_msg


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

otp_service = OTPService()


def get_otp_service() -> OTPService:
    """Return the global OTPService singleton."""
    return otp_service
