"""
🔔 Webhook Service - Send notifications when stuff happens!

This module handles sending webhook notifications to external services
like Discord, Slack, or custom endpoints when important events occur.

Events we notify about:
- 🚨 Tamper alerts (file integrity check failed)
- 🔥 File destruction (view limit reached)
- 👁️ File accessed (optional monitoring)
- ❌ Access denied (password failures, etc.)
"""

import httpx
import httpcore
from httpcore._backends.auto import AutoBackend
from httpcore._exceptions import ConnectError
import asyncio
import logging
import socket
import ipaddress
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Union, List
from urllib.parse import urlparse
import json
from core.security import _is_ip_restricted

logger = logging.getLogger(__name__)


def _ssrf_safe_url(url: str) -> bool:
    """
    Request-time SSRF guard — the second line of defence against DNS-rebinding.

    This mirrors the logic in :func:`core.security._resolve_and_classify` but
    is called **immediately before every outbound HTTP request** inside
    :class:`WebhookService`.  Re-validating here closes the TOCTOU window:
    even if a DNS entry was changed to an internal IP after the initial
    validation at ``/seal`` time, this guard will catch the re-delegate before
    the connection is made.

    Design (same as the validate-time guard):
    * ``socket.getaddrinfo`` — resolves both A and AAAA records.
    * ``ipaddress`` classification — blocks private, loopback, link-local,
      multicast, reserved, and unspecified addresses.
    * OR-gate on results — block if ANY resolved address is internal.
    * Fail-safe — block if resolution fails or returns nothing.

    Additionally, this function enforces that only ``http`` and ``https``
    schemes reach the network layer; any other value (e.g. ``file://``,
    ``ftp://``) is blocked unconditionally.

    Args:
        url: The raw webhook URL string that is about to be requested.

    Returns:
        ``True``  — URL is safe to request.
        ``False`` — URL must be blocked (internal target or bad scheme).
    """
    try:
        parsed = urlparse(url)
        scheme = (parsed.scheme or "").lower()
        if scheme not in ("http", "https"):
            logger.warning("SSRF guard (request-time): rejected non-http/https scheme '%s'.", scheme)
            return False

        hostname = parsed.hostname
        if not hostname:
            return False

        # Strip IPv6 brackets that urlparse may leave on .hostname in some
        # edge cases (Python version-dependent behaviour — strip defensively).
        hostname = hostname.strip('[]')

        results = socket.getaddrinfo(hostname, None)
        if not results:
            logger.warning("SSRF guard (request-time): no addresses for '%s' — blocking.", hostname)
            return False

        for _family, _type, _proto, _canonname, sockaddr in results:
            raw_ip = sockaddr[0]
            try:
                addr = ipaddress.ip_address(raw_ip)
            except ValueError:
                logger.warning(
                    "SSRF guard (request-time): malformed address '%s' for '%s' — blocking.",
                    raw_ip, hostname
                )
                return False

            if _is_ip_restricted(addr):
                logger.warning(
                    "SSRF guard (request-time): resolved '%s' for '%s' is internal — blocking.",
                    raw_ip, hostname
                )
                return False

    except socket.gaierror:
        logger.warning("SSRF guard (request-time): could not resolve '%s' — blocking.", url)
        return False
    except Exception:
        logger.warning("SSRF guard (request-time): unexpected error checking '%s' — blocking.", url, exc_info=True)
        return False

    return True


class _SSRFSafeBackend(AutoBackend):
    """
    Network backend that performs DNS resolution and validates that resolved IPs
    are not internal/private/loopback immediately before connecting the TCP socket,
    completely closing the DNS rebinding TOCTOU window.
    """

    async def connect_tcp(
        self,
        host: str,
        port: int,
        timeout: Optional[float] = None,
        local_address: Optional[str] = None,
        socket_options: Optional[Any] = None,
    ):
        clean_host = host.strip("[]")
        try:
            addr = ipaddress.ip_address(clean_host)
            is_ip = True
        except ValueError:
            is_ip = False

        if is_ip:
            if _is_ip_restricted(addr):
                logger.warning("SSRF guard (connect-time): direct IP '%s' is internal — blocking.", clean_host)
                raise ConnectError(f"SSRF Guard: IP {clean_host} is internal/restricted")
            safe_ips = [clean_host]
        else:
            try:
                loop = asyncio.get_running_loop()
                results = await loop.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
            except socket.gaierror as e:
                logger.warning("SSRF guard (connect-time): could not resolve '%s' — blocking.", host)
                raise ConnectError(f"SSRF Guard: DNS resolution failed for {host}") from e

            if not results:
                logger.warning("SSRF guard (connect-time): no addresses for '%s' — blocking.", host)
                raise ConnectError(f"SSRF Guard: No DNS records for {host}")

            safe_ips = []
            for _family, _socktype, _proto, _canonname, sockaddr in results:
                raw_ip = sockaddr[0]
                try:
                    addr = ipaddress.ip_address(raw_ip)
                except ValueError:
                    logger.warning("SSRF guard (connect-time): malformed address '%s' for '%s' — blocking.", raw_ip, host)
                    raise ConnectError(f"SSRF Guard: malformed IP {raw_ip} for {host}")

                if _is_ip_restricted(addr):
                    logger.warning("SSRF guard (connect-time): resolved '%s' for '%s' is internal — blocking.", raw_ip, host)
                    raise ConnectError(f"SSRF Guard: IP {raw_ip} for {host} is internal/restricted")

                if raw_ip not in safe_ips:
                    safe_ips.append(raw_ip)

        # Attempt connection across verified candidate IPs (supporting dual-stack fallback).
        # Note: httpcore retains self._origin.host for TLS SNI and cert validation!
        last_exc: Optional[Exception] = None
        for candidate_ip in safe_ips:
            try:
                return await super().connect_tcp(
                    host=candidate_ip,
                    port=port,
                    timeout=timeout,
                    local_address=local_address,
                    socket_options=socket_options,
                )
            except (ConnectError, httpcore.ConnectTimeout, OSError) as exc:
                last_exc = exc
                continue

        if last_exc is not None:
            raise last_exc


class SSRFSafeAsyncHTTPTransport(httpx.AsyncHTTPTransport):
    """
    Custom HTTPX transport enforcing DNS resolution & SSRF IP validation
    at TCP connection time to eliminate DNS rebinding TOCTOU vulnerabilities.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._pool._network_backend = _SSRFSafeBackend()


class WebhookService:
    """Service for sending webhook notifications"""
    
    def __init__(self):
        self.timeout = 10.0  # 10 second timeout for webhook calls
        self._client: Optional[httpx.AsyncClient] = None

    def _get_client(self) -> httpx.AsyncClient:
        """Get or initialize the persistent httpx.AsyncClient with SSRF-safe transport."""
        if self._client is None or self._client.is_closed:
            transport = SSRFSafeAsyncHTTPTransport(
                limits=httpx.Limits(
                    max_connections=20,
                    max_keepalive_connections=5,
                    keepalive_expiry=5.0,  # Bounded keepalive prevents stale DNS entries
                ),
            )
            self._client = httpx.AsyncClient(
                transport=transport,
                timeout=self.timeout,
                follow_redirects=False,  # SSRF: never follow redirects
            )
        return self._client

    async def close(self) -> None:
        """Gracefully close the underlying httpx client."""
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
            self._client = None
            logger.info("WebhookService httpx client closed")
    
    async def send_webhook(
        self,
        webhook_url: str,
        event_type: str,
        data: Dict[str, Any]
    ) -> tuple[bool, Optional[str]]:
        """
        Send a webhook notification to the specified URL
        
        Returns:
            (success: bool, error_message: Optional[str])
        """
        if not webhook_url or webhook_url.strip() == "":
            return False, "No webhook URL provided"
        
        # ------------------------------------------------------------------ #
        # Request-time SSRF guard (Layer 2 — DNS-rebinding mitigation)        #
        # ------------------------------------------------------------------ #
        # This re-validates the resolved destination IP immediately before     #
        # making the outbound connection, closing the TOCTOU window that       #
        # exists between initial validation at /seal time and this call.       #
        # ------------------------------------------------------------------ #
        if not _ssrf_safe_url(webhook_url):
            error_msg = "Webhook URL blocked by SSRF guard at request time"
            logger.error(
                "send_webhook: SSRF guard blocked outbound request to '%s' for event '%s'.",
                webhook_url[:60], event_type
            )
            return False, error_msg

        try:
            # Prepare the payload
            payload = {
                "event": event_type,
                "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "service": "BAR Web",
                **data
            }

            # Detect webhook type and format accordingly
            is_discord = "discord.com" in webhook_url.lower() or "discordapp.com" in webhook_url.lower()
            logger.debug("send_webhook: dispatching event '%s' (discord=%s).", event_type, is_discord)
            if is_discord:
                payload = self._format_discord_webhook(event_type, data)
            elif "slack.com" in webhook_url.lower():
                payload = self._format_slack_webhook(event_type, data)
            # else: generic JSON payload already constructed above

            # ---------------------------------------------------------------- #
            # Layer 3 — httpx hardening & connection pooling                   #
            # follow_redirects=False: a redirect to 127.0.0.1 would bypass     #
            # all URL-level validation — we refuse to follow any redirect.     #
            # ---------------------------------------------------------------- #
            client = self._get_client()
            response = await client.post(
                webhook_url,
                json=payload,
                headers={"Content-Type": "application/json"}
            )

            if response.status_code in [200, 204]:
                logger.info("send_webhook: event '%s' delivered successfully.", event_type)
                return True, None
            else:
                error_msg = f"Webhook returned status {response.status_code}"
                logger.warning(
                    "send_webhook: event '%s' delivery failed — %s.",
                    event_type, error_msg
                )
                return False, error_msg

        except httpx.ConnectError as e:
            error_msg = f"Webhook connection blocked by SSRF guard: {str(e)}"
            logger.warning("send_webhook: connection error for event '%s': %s", event_type, error_msg)
            return False, error_msg
        except asyncio.TimeoutError:
            error_msg = "Webhook request timed out"
            logger.warning("send_webhook: event '%s' timed out.", event_type)
            return False, error_msg
        except Exception as e:
            error_msg = f"Webhook failed: {str(e)}"
            logger.error("send_webhook: unexpected error for event '%s'.", event_type, exc_info=True)
            return False, error_msg
    
    def _format_discord_webhook(self, event_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Format payload for Discord webhooks"""
        # Choose color and emoji based on event type
        color_map = {
            "tamper_alert": 0xFF0000,      # Red
            "file_destroyed": 0xFF6600,    # Orange
            "file_accessed": 0x00FF00,     # Green
            "access_denied": 0xFFFF00      # Yellow
        }
        
        emoji_map = {
            "tamper_alert": "🚨",
            "file_destroyed": "🔥",
            "file_accessed": "👁️",
            "access_denied": "🚫"
        }
        
        color = color_map.get(event_type, 0x808080)
        emoji = emoji_map.get(event_type, "📢")
        
        # Build embed fields
        fields = []
        for key, value in data.items():
            if key not in ["timestamp"]:  # Skip timestamp as it's in footer
                fields.append({
                    "name": key.replace("_", " ").title(),
                    "value": str(value),
                    "inline": True
                })
        
        return {
            "embeds": [{
                "title": f"{emoji} BAR Web Alert: {event_type.replace('_', ' ').title()}",
                "color": color,
                "fields": fields,
                "footer": {
                    "text": "BAR Web Security Alert System"
                },
                "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            }]
        }
    
    def _format_slack_webhook(self, event_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Format payload for Slack webhooks"""
        emoji_map = {
            "tamper_alert": ":rotating_light:",
            "file_destroyed": ":fire:",
            "file_accessed": ":eyes:",
            "access_denied": ":no_entry:"
        }
        
        emoji = emoji_map.get(event_type, ":bell:")
        
        # Build text content
        text_lines = [f"*{emoji} BAR Web Alert: {event_type.replace('_', ' ').title()}*"]
        for key, value in data.items():
            text_lines.append(f"• *{key.replace('_', ' ').title()}:* {value}")
        
        return {
            "text": "\n".join(text_lines)
        }
    
    async def send_tamper_alert(
        self,
        webhook_url: str,
        filename: str,
        token: Optional[str] = None,
        original_hash: Optional[str] = None,
        computed_hash: Optional[str] = None
    ):
        """Send a tamper alert webhook"""
        data = {
            "filename": filename,
            "message": "File integrity check failed - possible tampering detected",
            "severity": "HIGH"
        }
        
        if token:
            data["file_token"] = token[:16] + "..."  # Partial token for privacy
        if original_hash:
            data["original_hash"] = original_hash[:16] + "..."
        if computed_hash:
            data["computed_hash"] = computed_hash[:16] + "..."
        
        return await self.send_webhook(webhook_url, "tamper_alert", data)
    
    async def send_destruction_alert(
        self,
        webhook_url: str,
        filename: str,
        reason: str,
        views_used: Optional[int] = None,
        max_views: Optional[int] = None
    ):
        """Send a file destruction webhook"""
        data = {
            "filename": filename,
            "reason": reason,
            "message": "File has been permanently destroyed"
        }
        
        if views_used is not None and max_views is not None:
            data["views"] = f"{views_used}/{max_views}"
        
        return await self.send_webhook(webhook_url, "file_destroyed", data)
    
    async def send_access_alert(
        self,
        webhook_url: str,
        filename: str,
        ip_address: str,
        views_remaining: Optional[int] = None
    ):
        """Send a file access notification webhook"""
        data = {
            "filename": filename,
            "ip_address": ip_address[:10] + "...",  # Partial IP for privacy
            "message": "File accessed successfully"
        }
        
        if views_remaining is not None:
            data["views_remaining"] = views_remaining
        
        return await self.send_webhook(webhook_url, "file_accessed", data)
    
    async def send_access_denied_alert(
        self,
        webhook_url: str,
        filename: str,
        reason: str,
        ip_address: str
    ):
        """Send an access denied webhook"""
        data = {
            "filename": filename,
            "reason": reason,
            "ip_address": ip_address[:10] + "...",  # Partial IP for privacy
            "message": "Access attempt denied"
        }
        
        return await self.send_webhook(webhook_url, "access_denied", data)


# Global webhook service instance
_webhook_service = None


def get_webhook_service() -> WebhookService:
    """Get the global webhook service instance"""
    global _webhook_service
    if _webhook_service is None:
        _webhook_service = WebhookService()
    return _webhook_service
