"""
BAR Web API - Burn After Reading
Secure file sharing with encryption, view limits, and 2FA.
"""
import os
import asyncio
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import core infrastructure
from core.config import settings
from core import security

# Import utilities
import database
import cleanup

# Import API routes
from api.routes import upload, seal, decrypt, share


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Secure file sharing with burn-after-reading capabilities"
)


# Configure CORS middleware
print(f"🔒 CORS allowed origins: {settings.allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
    expose_headers=[
        "X-BAR-Views-Remaining",
        "X-BAR-Should-Destroy",
        "X-BAR-View-Only",
        "X-BAR-Filename",
        "X-BAR-Storage-Mode",
        "X-BAR-Destroyed",
        "X-BAR-Metadata"
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
    import env_validator
    env_validator.validate_and_exit_on_error()
    
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
