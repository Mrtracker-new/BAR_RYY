"""
Analytics utilities for BAR Web
Handles device detection and geolocation
"""
from __future__ import annotations

import asyncio as _asyncio
import ipaddress
import logging
import os
import time as _time
from collections import OrderedDict as _OrderedDict
from typing import Optional, Dict, List

import httpx

logger = logging.getLogger(__name__)


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
            logger.warning("Invalid CIDR ignored: %r", cidr)
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
# Geolocation — cached, non-blocking, feature-gated
# ---------------------------------------------------------------------------
# Key design decisions:
#   1. LRU + TTL cache with negative caching:  IP->geo is nearly static;
#      caching avoids burning the ipapi.co free-tier quota (~1 k/day) on
#      repeat visitors.  Failed lookups are cached with a shorter TTL to
#      prevent hammering ipapi.co for consistently-failing IPs.
#   2. Managed httpx client:  connection pooling + keep-alive.  Lifecycle
#      is tied to FastAPI startup/shutdown via init/close helpers.
#   3. Feature flag:  ENABLE_GEOLOCATION=false skips the HTTP call entirely.
#   4. backfill_geolocation():  designed for Starlette BackgroundTask so
#      geolocation never blocks the download response.
#   5. ipaddress module:  proper RFC-compliant IP classification instead of
#      error-prone string prefix matching.
# ---------------------------------------------------------------------------

_GEO_CACHE_MAX: int = 2048         # max entries (LRU eviction)
_GEO_CACHE_TTL: int = 86_400       # 24 hours in seconds (success)
_GEO_NEG_CACHE_TTL: int = 300      # 5 minutes (failed lookups)
_geo_cache: _OrderedDict[str, Dict] = _OrderedDict()
_geo_lock: _asyncio.Lock = _asyncio.Lock()

# Managed httpx client — created at startup, closed at shutdown.
_httpx_client: Optional[httpx.AsyncClient] = None

_LOCAL_GEO: Dict[str, str] = {"country": "Local", "city": "Localhost"}
_UNKNOWN_GEO: Dict[str, str] = {"country": "Unknown", "city": "Unknown"}


# ---------------------------------------------------------------------------
# httpx lifecycle — called from app.py startup / shutdown
# ---------------------------------------------------------------------------

async def init_httpx_client() -> None:
    """Create the module-level httpx.AsyncClient.

    Must be called once during application startup (e.g. FastAPI's
    ``on_event("startup")``).  Calling it more than once is a no-op.
    """
    global _httpx_client
    if _httpx_client is None:
        _httpx_client = httpx.AsyncClient(timeout=3.0)
        logger.info("Geolocation httpx client initialised")


async def close_httpx_client() -> None:
    """Gracefully close the module-level httpx.AsyncClient.

    Must be called during application shutdown so that the underlying
    connection pool is drained and TCP sockets are released cleanly.
    """
    global _httpx_client
    if _httpx_client is not None:
        await _httpx_client.aclose()
        _httpx_client = None
        logger.info("Geolocation httpx client closed")


def _get_httpx_client() -> httpx.AsyncClient:
    """Return the module-level httpx.AsyncClient.

    Raises ``RuntimeError`` if ``init_httpx_client()`` was never called,
    making lifecycle misuse immediately obvious instead of silently
    creating an unmanaged client.
    """
    if _httpx_client is None:
        raise RuntimeError(
            "Geolocation httpx client not initialised — "
            "call analytics.init_httpx_client() during app startup"
        )
    return _httpx_client


# ---------------------------------------------------------------------------
# IP classification — using stdlib ipaddress for RFC-compliant checks
# ---------------------------------------------------------------------------

def _is_non_routable_ip(ip: str) -> bool:
    """Return True for IPs that should never be sent to an external geo API.

    Uses the ``ipaddress`` module's built-in RFC-compliant properties:
    ``is_private``, ``is_loopback``, ``is_reserved``, ``is_link_local``,
    and ``is_unspecified`` — covering all of RFC 1918, RFC 4193, RFC 5737,
    RFC 3927, and IPv6 equivalents.  This replaces error-prone manual
    prefix matching.
    """
    if not ip or ip == "Unknown":
        return True
    try:
        addr = ipaddress.ip_address(ip)
        return (
            addr.is_private
            or addr.is_loopback
            or addr.is_reserved
            or addr.is_link_local
            or addr.is_unspecified
        )
    except ValueError:
        # Malformed IP string — treat as non-routable (don't send to API)
        logger.debug("Malformed IP treated as non-routable: %r", ip)
        return True


# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------

async def _cache_get(ip: str) -> Optional[Dict[str, str]]:
    """Look up *ip* in the geo cache.

    Returns the cached dict on a valid hit, ``_UNKNOWN_GEO`` copy on a
    negative-cache hit, or ``None`` on a miss (including TTL-expired
    entries which are evicted inline).
    """
    async with _geo_lock:
        entry = _geo_cache.get(ip)
        if entry is None:
            return None  # true miss

        age = _time.monotonic() - entry["_ts"]

        # Negative-cache entry (short TTL)
        if entry.get("_neg"):
            if age < _GEO_NEG_CACHE_TTL:
                _geo_cache.move_to_end(ip)
                return _UNKNOWN_GEO.copy()
            del _geo_cache[ip]
            return None

        # Positive-cache entry (long TTL)
        if age < _GEO_CACHE_TTL:
            _geo_cache.move_to_end(ip)
            return {"country": entry["country"], "city": entry["city"]}

        # TTL expired — evict
        del _geo_cache[ip]
        return None


async def _cache_put(ip: str, geo: Dict[str, str], *, negative: bool = False) -> None:
    """Insert or update an entry in the geo cache with LRU eviction."""
    async with _geo_lock:
        if negative:
            _geo_cache[ip] = {"_neg": True, "_ts": _time.monotonic()}
        else:
            _geo_cache[ip] = {
                "country": geo["country"],
                "city": geo["city"],
                "_ts": _time.monotonic(),
            }
        _geo_cache.move_to_end(ip)
        # LRU eviction
        while len(_geo_cache) > _GEO_CACHE_MAX:
            _geo_cache.popitem(last=False)


# ---------------------------------------------------------------------------
# Public geolocation API
# ---------------------------------------------------------------------------

async def get_geolocation(ip_address: str) -> Optional[Dict[str, str]]:
    """
    Get geolocation data from IP address using ipapi.co (free tier).

    Returns dict with ``country`` and ``city`` keys, or the "Unknown"
    fallback if the lookup fails or is disabled.

    Performance characteristics
    ---------------------------
    * **Cache hit (common case):** ~0 ms — no I/O at all.
    * **Negative cache hit:** ~0 ms — avoids re-hammering failed IPs for 5 min.
    * **Cache miss:** single HTTP GET with a 3 s timeout.
    * **Feature disabled:** immediate return, no HTTP call.
    """
    # --- Feature flag guard ------------------------------------------------
    from core.config import settings
    if not settings.enable_geolocation:
        return _UNKNOWN_GEO.copy()

    # --- Non-routable IPs — no point querying the API ---------------------
    if _is_non_routable_ip(ip_address):
        return _LOCAL_GEO.copy()

    # --- Cache lookup (handles both positive and negative entries) ---------
    cached = await _cache_get(ip_address)
    if cached is not None:
        return cached

    # --- Cache miss — call ipapi.co ----------------------------------------
    try:
        client = _get_httpx_client()
        response = await client.get(f"https://ipapi.co/{ip_address}/json/")
        if response.status_code == 200:
            data = response.json()
            result: Dict[str, str] = {
                "country": data.get("country_name", "Unknown"),
                "city": data.get("city", "Unknown"),
            }
            await _cache_put(ip_address, result)
            return result
        else:
            # Non-200 (rate-limited, invalid IP, etc.) — negative cache
            logger.warning(
                "Geolocation API returned %d for %s",
                response.status_code, ip_address,
            )
            await _cache_put(ip_address, _UNKNOWN_GEO, negative=True)
    except Exception:
        logger.warning("Geolocation lookup failed for %s", ip_address, exc_info=True)
        await _cache_put(ip_address, _UNKNOWN_GEO, negative=True)

    return _UNKNOWN_GEO.copy()


async def backfill_geolocation(db, token: str, ip_address: str) -> None:
    """Resolve geolocation and update the access log row.

    Designed to run as a ``starlette.background.BackgroundTask`` attached
    to the ``StreamingResponse`` by the share endpoint.  This ensures:

    * The task lifecycle is managed by Starlette (proper cancellation on
      client disconnect, structured exception logging).
    * No orphaned ``asyncio.Task`` objects that could be garbage-collected
      before completion.

    If the lookup or DB update fails, the access log row simply retains its
    ``NULL`` country/city — acceptable degradation.
    """
    try:
        geo = await get_geolocation(ip_address)
        if geo and geo.get("country") not in (None, "Unknown"):
            await db.update_access_log_geo(token, ip_address, geo)
    except Exception:
        # Swallow — this is best-effort background work.  The access log row
        # already exists; it just won't have geo data.
        logger.warning("Geo backfill failed for token=%s", token, exc_info=True)
