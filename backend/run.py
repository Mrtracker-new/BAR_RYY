"""
Universal startup script for BAR Web backend
Works on Railway, Render, Fly.io, local, etc.
"""
import os
import uvicorn
from core import env_validator

if __name__ == "__main__":
    # Validate environment variables before starting
    env_validator.validate_and_exit_on_error()
    
    # Get port from environment or default to 8000
    port = int(os.getenv("PORT", 8000))
    
    print(f"🚀 Starting BAR Web API on port {port}")
    print(f"📍 Environment: {'Production' if os.getenv('IS_PRODUCTION') else 'Development'}")
    
    # Start uvicorn
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=port,
        log_level="info"  # Show startup logs, request logs, and errors for debugging
    )
