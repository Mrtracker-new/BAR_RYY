"""
CSRF Guard — ASGI middleware for Cross-Site Request Forgery protection.

Strategy
--------
Since the API is entirely stateless (JSON + bearer-style tokens, no cookies),
a traditional "synchronizer token" CSRF pattern is not needed.  Instead we
use the *Custom Request Header* technique:

  1. Every mutating request (POST / PUT / PATCH / DELETE) MUST include the
     ``X-Requested-With: XMLHttpRequest`` header.

  2. Browsers never add this header to cross-origin Simple Requests, and
     cross-origin ``fetch()`` / ``XMLHttpRequest`` calls that *do* set it will
     trigger a CORS pre-flight.  The pre-flight is only approved for origins in
     ``settings.allowed_origins``, so an attacker's page cannot pass *both*
     the CORS check and this header check simultaneously.

  3. As defence-in-depth, if an ``Origin`` or ``Referer`` header is present it
     is validated against ``settings.allowed_origins``.  A missing
     Origin/Referer is allowed (e.g. server-to-server, curl, mobile apps) to
     avoid false positives.

Cookie policy (forward-looking)
--------------------------------
The API does NOT use cookies today.  If cookies are ever introduced:

  * Always set ``SameSite=Strict; Secure; HttpOnly`` on every ``Set-Cookie``.
  * Re-evaluate whether ``allow_credentials=True`` is required in
    ``CORSMiddleware`` (it should stay ``False`` unless credentials are a hard
    requirement).
  * Consider adding a server-generated, per-session ``X-CSRF-Token`` that this
    middleware validates in addition to ``X-Requested-With``.

Exemptions
----------
  * ``GET``, ``HEAD``, ``OPTIONS`` — read-only or pre-flight, always exempt.
  * ``/health``, ``/`` — health-check endpoints, always exempt.
"""
import logging
from urllib.parse import urlparse

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# Methods that mutate state — CSRF guard applies to all of these.
_MUTATING_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})

# Paths that are explicitly exempt from CSRF checks.
# Use exact strings or simple prefixes — no regex needed here.
_EXEMPT_PATHS = frozenset({"/", "/health"})

# The canonical value we require.  Some clients send the bare header without a
# value (e.g. jQuery pre-1.5 sent just the header name); we accept any
# non-empty value to stay broadly compatible.
_REQUIRED_HEADER = "x-requested-with"


def _origin_is_allowed(origin: str, allowed_origins: list[str]) -> bool:
    """
    Return True if *origin* appears in the allowed origins list, or if the
    list contains the wildcard ``"*"``.

    Comparison is case-insensitive and trailing slashes are normalised.
    """
    origin = origin.rstrip("/").lower()
    for allowed in allowed_origins:
        if allowed == "*":
            return True
        if allowed.rstrip("/").lower() == origin:
            return True
    return False


def _extract_origin_from_referer(referer: str) -> str:
    """
    Parse a ``Referer`` URL and return its origin (scheme + host + port).
    Returns an empty string if parsing fails.
    """
    try:
        parsed = urlparse(referer)
        port = f":{parsed.port}" if parsed.port not in (None, 80, 443) else ""
        return f"{parsed.scheme}://{parsed.hostname}{port}"
    except Exception:
        return ""


class CSRFGuard(BaseHTTPMiddleware):
    """
    ASGI middleware that enforces the Custom Request Header CSRF mitigation.

    Must be added to the application **after** ``CORSMiddleware`` so it runs
    on the inner side of the middleware stack (i.e. it sees requests that have
    already passed the CORS check).

    Parameters
    ----------
    app:
        The ASGI application to wrap.
    allowed_origins:
        List of origins (scheme + host + optional port) that are considered
        trusted.  Passed in from ``settings.allowed_origins`` so there is a
        single source of truth.
    """

    def __init__(self, app, allowed_origins: list[str]):
        super().__init__(app)
        self._allowed = allowed_origins

    async def dispatch(self, request: Request, call_next):
        method = request.method.upper()
        path = request.url.path

        # ── 1. Exempt safe methods and health-check paths ──────────────────
        if method not in _MUTATING_METHODS or path in _EXEMPT_PATHS:
            return await call_next(request)

        # ── 2. Require X-Requested-With header ─────────────────────────────
        xrw = request.headers.get(_REQUIRED_HEADER, "").strip()
        if not xrw:
            logger.warning(
                "CSRF guard: rejected %s %s — missing X-Requested-With "
                "(origin=%s, ip=%s)",
                method,
                path,
                request.headers.get("origin", "—"),
                getattr(request.client, "host", "—"),
            )
            return JSONResponse(
                status_code=403,
                content={"detail": "CSRF check failed: X-Requested-With header is required."},
            )

        # ── 3. Origin / Referer validation (defence-in-depth) ──────────────
        origin_header = request.headers.get("origin", "").strip()
        referer_header = request.headers.get("referer", "").strip()

        # Determine the effective origin to validate.
        check_origin: str | None = None
        if origin_header:
            check_origin = origin_header
        elif referer_header:
            check_origin = _extract_origin_from_referer(referer_header)

        # If an origin is present and is NOT in our allow-list → reject.
        # A completely absent Origin/Referer is allowed (curl, mobile, etc.).
        if check_origin and not _origin_is_allowed(check_origin, self._allowed):
            logger.warning(
                "CSRF guard: rejected %s %s — untrusted origin '%s' (ip=%s)",
                method,
                path,
                check_origin,
                getattr(request.client, "host", "—"),
            )
            return JSONResponse(
                status_code=403,
                content={"detail": "CSRF check failed: origin not permitted."},
            )

        # ── 4. All checks passed ────────────────────────────────────────────
        return await call_next(request)
