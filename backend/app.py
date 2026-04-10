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


# Configure CORS middleware
print(f"🔒 CORS allowed origins: {settings.allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        # Analytics key header — must be explicitly allowed so the browser's
        # CORS preflight (OPTIONS) for /analytics/{token} succeeds.
        # The key is transmitted as a header rather than a query parameter to
        # prevent it from appearing in server access logs, browser history,
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


# Add security headers middleware
@app.middleware("http")
async def add_security_headers_middleware(request: Request, call_next):
    """Apply security headers to all responses."""
    response = await call_next(request)
    return security.add_security_headers(response)


# Startup event
@app.on_event("startup")
async def startup_event():
    """Start background tasks on app startup."""
    print(f"🚀 {settings.app_name} starting...")
    
    # Initialize database in background to not block health checks
    async def init_background():
        try:
            await database.init_database()
            print("✅ Database initialized")
            # Start cleanup task
            asyncio.create_task(cleanup.run_cleanup_loop())
            print("✅ Cleanup task started")
        except Exception as e:
            print(f"⚠️ Database init failed: {e}")
            print("Continuing with limited functionality...")
    
    # Run in background
    asyncio.create_task(init_background())
    print(f"🚀 {settings.app_name} started (database initializing in background)")


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
