"""
BAR Web API - Burn After Reading
Secure file sharing with encryption, view limits, and 2FA.
"""
import os
import asyncio
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from dotenv import load_dotenv
from core.csrf import CSRFGuard

# Load environment variables
load_dotenv()

# Import core infrastructure
from core.config import settings
from core import security

# Import utilities
from core import database
from services import cleanup

# Import API routes
from api.routes import upload, seal, decrypt, share


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Secure file sharing with burn-after-reading capabilities"
)


# ---------------------------------------------------------------------------
# ProxyHeadersMiddleware — MUST be added first (outermost layer)
# ---------------------------------------------------------------------------
# Uvicorn's built-in middleware rewrites request.client.host to the real
# client IP extracted from X-Forwarded-For, but *only* when the direct TCP
# peer is in the trusted_hosts list.  Connections from any other host are
# left as-is (request.client.host = actual peer), so attackers who connect
# directly cannot inject a spoofed IP via that header.
#
# TRUSTED_PROXY_CIDRS env-var controls which CIDRs are trusted (same value
# read by services/analytics.py).  Defaults to Render's LB ranges.
# Set to 'none' to disable entirely (e.g. for local dev without a proxy).
_raw_cidrs = os.getenv("TRUSTED_PROXY_CIDRS", "").strip()
_trusted_hosts: list[str] = []
if _raw_cidrs.lower() != "none":
    # ProxyHeadersMiddleware trusted_hosts accepts exact IPs or "*".
    # We use "*" when behind Render because Render's LB IPs are stable but
    # numerous; the CIDR-level enforcement is handled by analytics.get_client_ip.
    # Do NOT use "*" if this service is directly internet-facing.
    _is_production = os.getenv("IS_PRODUCTION", "false").lower() == "true"
    _trusted_hosts = ["*"] if _is_production else ["127.0.0.1", "::1"]

if _trusted_hosts:
    app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=_trusted_hosts)
    print(f"🔒 ProxyHeadersMiddleware enabled — trusted_hosts={_trusted_hosts}")
else:
    print("🔒 ProxyHeadersMiddleware disabled (TRUSTED_PROXY_CIDRS=none)")


# ---------------------------------------------------------------------------
# CORS middleware
# ---------------------------------------------------------------------------
# Security notes
# ~~~~~~~~~~~~~~
# allow_credentials=False — the API uses NO cookies.  Setting this to True
# while also listing wide-open origins (including localhost) would allow an
# attacker's page to issue credentialed cross-origin requests.  Must stay
# False unless cookies are deliberately introduced.
#
# Cookie policy (forward-looking)
# ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
# If cookies are ever added:
#   • Set SameSite=Strict; Secure; HttpOnly on every Set-Cookie response.
#   • Only flip allow_credentials=True if cross-origin cookie sharing is a
#     hard requirement (it rarely is).
#   • Pair with a server-generated per-session X-CSRF-Token validated by
#     the CSRFGuard middleware below.
#
# Origin lists
# ~~~~~~~~~~~~
# settings.allowed_origins automatically returns the production-only list
# (no localhost) when IS_PRODUCTION=true, and the full dev list otherwise.
# See core/config.py for details.
# ---------------------------------------------------------------------------
print(f"🔒 CORS allowed origins: {settings.allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,           # No cookies → credentials flag must be False
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        # Required by CSRFGuard — every mutating fetch() from the frontend
        # must include this header.  Its presence forces a CORS pre-flight
        # for cross-origin requests, preventing Simple Request CSRF attacks.
        "X-Requested-With",
        # Analytics key header — transmitted as a header rather than a query
        # parameter to keep it out of server access logs, browser history,
        # CDN/proxy logs, and Referer headers.
        "X-Analytics-Key",
    ],
    expose_headers=[
        "X-BAR-Views-Remaining",
        "X-BAR-Should-Destroy",
        "X-BAR-View-Only",
        "X-BAR-Filename",
        "X-BAR-Storage-Mode",
        "X-BAR-Destroyed",
        "X-BAR-Metadata",
        "X-BAR-Is-New-View",
        "X-BAR-Auto-Refresh-Seconds"
    ],
)

# ---------------------------------------------------------------------------
# CSRF Guard middleware — must be added AFTER CORSMiddleware
# ---------------------------------------------------------------------------
# Starlette's middleware stack is LIFO: the last middleware added is the first
# to process an inbound request.  By registering CSRFGuard after
# CORSMiddleware we ensure:
#   1. CORSMiddleware handles the pre-flight OPTIONS exchange first.
#   2. CSRFGuard only inspects requests that have already passed the CORS
#      origin check — no unnecessary 403s for legitimate pre-flights.
#
# What it enforces:
#   • Every POST/PUT/PATCH/DELETE must include X-Requested-With (any value).
#   • If Origin or Referer is present, it must match settings.allowed_origins.
#   • GET / HEAD / OPTIONS are always exempt.
#   • /health and / are always exempt.
# ---------------------------------------------------------------------------
app.add_middleware(CSRFGuard, allowed_origins=settings.allowed_origins)
print("🔒 CSRFGuard middleware enabled")


# Add security headers middleware
@app.middleware("http")
async def add_security_headers_middleware(request: Request, call_next):
    """Apply security headers to all responses."""
    response = await call_next(request)
    return security.add_security_headers(response)


# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize app on startup — must complete before requests are served."""
    print(f"🚀 {settings.app_name} starting...")

    # Initialize database synchronously so we're ready before the first request.
    # Previously this ran in a background task, causing a race condition: requests
    # arriving within the first ~100 ms (e.g. the Vite proxy's health probe) would
    # find the DB uninitialized and fail/hang silently.
    try:
        await database.init_database()
        print("✅ Database initialized")
    except Exception as e:
        # Log clearly — don't silently swallow DB init failures.
        print(f"❌ Database initialization failed: {e}")
        print("   Continuing with limited functionality (some endpoints may fail).")

    # Start the background cleanup loop after DB is confirmed ready.
    asyncio.create_task(cleanup.run_cleanup_loop())
    print("✅ Cleanup task started")

    print(f"🚀 {settings.app_name} is ready to serve requests")


# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Clean up on shutdown."""
    await database.close_database()
    print(f"👋 {settings.app_name} shutting down")


# Register routers
app.include_router(upload.router, tags=["Upload"])
app.include_router(seal.router, tags=["Seal"])
app.include_router(decrypt.router, tags=["Decrypt"])
app.include_router(share.router, tags=["Share"])


# Health check endpoints
@app.get("/")
async def root():
    """Root endpoint with API information."""
    resp = JSONResponse(content={
        "message": f"{settings.app_name} - Burn After Reading",
        "version": settings.app_version,
        "status": "healthy",
        "endpoints": [
            "/upload - Upload file",
            "/seal - Seal and generate .bar file",
            "/decrypt/{bar_id} - Decrypt and retrieve file",
            "/share/{token} - Access server-side file",
            "/storage-info - Get storage mode capabilities"
        ]
    })
    return security.add_security_headers(resp)


@app.get("/health")
async def health_check():
    """Simple health check endpoint for deployment platforms."""
    return {"status": "healthy", "service": settings.app_name}


# Main entry point
if __name__ == "__main__":
    # Validate environment variables if running app.py directly
    from core import env_validator
    env_validator.validate_and_exit_on_error()
    
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
