"""
Universal startup script for BAR Web backend
Works on Railway, Render, Fly.io, local, etc.
"""
import os
import uvicorn

if __name__ == "__main__":
    # Get port from environment or default to 8000
    port = int(os.getenv("PORT", 8000))
    
    print(f"🚀 Starting BAR Web API on port {port}")
    print(f"📍 Environment: {'Production' if os.getenv('IS_PRODUCTION') else 'Development'}")
    
    # Start uvicorn
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=port,
        log_level="info"
    )
