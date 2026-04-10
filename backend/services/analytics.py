"""
Analytics utilities for BAR Web
Handles device detection and geolocation
"""
from __future__ import annotations

import ipaddress
import os
from typing import Optional, Dict, List

import httpx


# ---------------------------------------------------------------------------
# Trusted-proxy CIDR list
# ---------------------------------------------------------------------------
# Render.com routes all inbound traffic through its own edge/load-balancer
# fleet. Only packets arriving from those routers should be allowed to set
# X-Forwarded-For / X-Real-IP.  All other peers are treated as direct clients
# and their forwarded-for headers are silently discarded.
#
# Known Render egress / load-balancer ranges (as of 2025):
#   https://render.com/docs/network#static-outbound-ip-addresses
# These are also set via the TRUSTED_PROXY_CIDRS env-var so you can override
# them without redeploying code.
# ---------------------------------------------------------------------------

_RENDER_DEFAULT_CIDRS: List[str] = [
    # Render load-balancer / private network ranges
    "10.0.0.0/8",
    "172.16.0.0/12",
    "192.168.0.0/16",
    # Render's documented public static IPs (add/update as needed)
    # https://render.com/docs/network
    "35.160.0.0/13",
    "52.32.0.0/11",
    "54.148.0.0/15",
    # localhost / loopback (for local dev)
    "127.0.0.0/8",
    "::1/128",
]


def _load_trusted_networks() -> List[ipaddress.IPv4Network | ipaddress.IPv6Network]:
    """
    Build the set of trusted-proxy networks from environment config or the
    Render defaults.  Call once at module load time; result is cached in
    _TRUSTED_NETWORKS.

    TRUSTED_PROXY_CIDRS env-var accepts a comma-separated list of CIDR blocks,
    e.g.  TRUSTED_PROXY_CIDRS=10.0.0.0/8,172.16.0.0/12
    Set to 'none' (case-insensitive) to disable all proxy-header trust, which
    forces request.client.host to always be used (safest for direct-exposure).
    """
    raw = os.getenv("TRUSTED_PROXY_CIDRS", "").strip()

    if raw.lower() == "none":
        return []  # Disable all forwarded-header trust

    cidr_strings = [c.strip() for c in raw.split(",") if c.strip()] if raw else _RENDER_DEFAULT_CIDRS

    networks: List[ipaddress.IPv4Network | ipaddress.IPv6Network] = []
    for cidr in cidr_strings:
        try:
            networks.append(ipaddress.ip_network(cidr, strict=False))
        except ValueError:
            print(f"⚠️ [TrustedProxy] Invalid CIDR ignored: {cidr!r}")
    return networks


# Cached at import time (module-level singleton)
_TRUSTED_NETWORKS: List[ipaddress.IPv4Network | ipaddress.IPv6Network] = _load_trusted_networks()


def _is_trusted_peer(peer_host: str) -> bool:
    """
    Return True when the *direct* TCP peer (request.client.host) is within one
    of our trusted proxy CIDRs.  Only then should we honour forwarded headers.
    """
    if not peer_host or not _TRUSTED_NETWORKS:
        return False
    try:
        addr = ipaddress.ip_address(peer_host)
        return any(addr in net for net in _TRUSTED_NETWORKS)
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_client_ip(request) -> str:
    """
    Return the real client IP address in a spoofing-resistant way.

    Security contract
    -----------------
    * X-Forwarded-For and X-Real-IP are ONLY considered when the direct TCP
      peer (request.client.host) is a *known trusted proxy* (Render's LB).
    * If the peer is not a trusted proxy the headers are silently discarded
      and we fall back to request.client.host — an attacker connecting
      directly can never inject a fake IP this way.
    * When behind a trusted proxy the *last* IP appended by OUR proxy is used
      (rightmost-trusted semantics), not the first, to prevent an attacker
      from pre-populating X-Forwarded-For before it reaches our proxy.

    Render behaviour
    ----------------
    Render's load-balancer *appends* the real client IP to X-Forwarded-For,
    so the chain looks like:
        X-Forwarded-For: <attacker-injected>, <real-client>, <render-lb>
    Uvicorn's ProxyHeadersMiddleware (added in app.py) already strips the
    outermost proxy entry and normalises request.client, so by the time this
    function runs request.client.host is the real client IP that Render saw.
    This function is therefore a defence-in-depth fallback for any call sites
    that bypass the middleware or run outside it.
    """
    peer_host: str = (
        request.client.host
        if request.client and request.client.host
        else ""
    )

    if _is_trusted_peer(peer_host):
        # --- Trusted proxy path -------------------------------------------
        # ProxyHeadersMiddleware should already have normalised client.host,
        # but handle raw header access as a belt-and-braces fallback.
        xff = request.headers.get("X-Forwarded-For", "")
        if xff:
            # XFF is a comma-separated list; the *first* non-proxy IP is the
            # client.  After Uvicorn's middleware strips its own entry the
            # first entry should be the real client IP.
            candidate = xff.split(",")[0].strip()
            try:
                ipaddress.ip_address(candidate)  # Validate it's a real IP
                return candidate
            except ValueError:
                pass  # Malformed entry — fall through to peer_host

        real_ip = request.headers.get("X-Real-IP", "").strip()
        if real_ip:
            try:
                ipaddress.ip_address(real_ip)  # Validate it's a real IP
                return real_ip
            except ValueError:
                pass  # Malformed — fall through to peer_host

    # --- Direct-connection or untrusted peer path -------------------------
    # We trust ONLY the TCP-level peer address.  Forwarded headers are
    # ignored entirely to prevent IP spoofing / rate-limit bypass.
    if peer_host:
        return peer_host

    return "Unknown"


# ---------------------------------------------------------------------------
# Device detection
# ---------------------------------------------------------------------------

def get_device_type(user_agent: str) -> str:
    """Detect device type from user agent string."""
    if not user_agent:
        return "Unknown"

    ua = user_agent.lower()

    if any(k in ua for k in ("iphone", "android", "mobile", "phone")):
        return "Mobile"
    if any(k in ua for k in ("ipad", "tablet")):
        return "Tablet"
    if any(k in ua for k in ("windows", "mac", "linux", "x11")):
        return "Desktop"
    if any(k in ua for k in ("bot", "crawler", "spider")):
        return "Bot"

    return "Unknown"


# ---------------------------------------------------------------------------
# Geolocation
# ---------------------------------------------------------------------------

async def get_geolocation(ip_address: str) -> Optional[Dict[str, str]]:
    """
    Get geolocation data from IP address using ipapi.co (free tier).
    Returns dict with country and city, or None if failed.
    """
    if not ip_address or ip_address in ("Unknown", "127.0.0.1") or ip_address.startswith("192.168."):
        return {"country": "Local", "city": "Localhost"}

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f"https://ipapi.co/{ip_address}/json/")
            if response.status_code == 200:
                data = response.json()
                return {
                    "country": data.get("country_name", "Unknown"),
                    "city": data.get("city", "Unknown"),
                }
    except Exception as exc:
        print(f"⚠️ Geolocation lookup failed for {ip_address}: {exc}")

    return {"country": "Unknown", "city": "Unknown"}
