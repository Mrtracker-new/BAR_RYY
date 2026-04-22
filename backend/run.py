"""
Canonical startup script for BAR Web backend.

This is the ONLY supported entry point for production deployments:
  • Render managed:   render.yaml  startCommand: python run.py
  • Docker:           Dockerfile   CMD ["python", "run.py"]
  • Heroku / others:  Procfile     web: uvicorn app:app ...
  • Local dev:        python run.py

Do NOT use 'python app.py' in production; its __main__ block explicitly
rejects launches when IS_PRODUCTION=true or the RENDER env-var is set.
"""
import os
import uvicorn
from core import env_validator

if __name__ == "__main__":
    # Validate required environment variables before starting the server.
    # Exits with code 1 if critical vars are missing in production.
    env_validator.validate_and_exit_on_error()

    # Read port from the hosting platform's environment variable.
    # Render / Railway / Fly.io all inject PORT automatically.
    port = int(os.getenv("PORT", 8000))

    # Detect production by IS_PRODUCTION flag OR the RENDER env-var that
    # Render injects automatically — consistent with app.py and security.py.
    is_prod = (
        os.getenv("IS_PRODUCTION", "").lower() == "true"
        or bool(os.getenv("RENDER"))
    )
    env_label = "Production" if is_prod else "Development"

    print(f"🚀 Starting BAR Web API on port {port}")
    print(f"📍 Environment: {env_label}")

    # -----------------------------------------------------------------------
    # reload=False is intentional and MUST NOT be changed to True.
    #
    # reload=True enables uvicorn's watchdog / inotify file-scanner which:
    #   • Spawns a child process that bypasses SIGTERM / SIGINT propagation,
    #     breaking graceful-shutdown on Render / Heroku / Fly.io / Docker.
    #   • Has had CVEs in older watchdog builds (filesystem traversal).
    #   • Consumes unnecessary CPU and memory with no production benefit.
    #
    # For local auto-reload during development use an external watcher:
    #   watchfiles "uvicorn app:app --host 0.0.0.0 --port 8000" .
    # -----------------------------------------------------------------------
    uvicorn.run(
        "app:app",
        host="0.0.0.0",         # Bind to all interfaces — expected behind a reverse proxy
        port=port,
        log_level="info",       # Startup, request, and error logs visible in platform logs
        access_log=True,        # Per-request log lines — required for audit trails
        reload=False,           # See comment block above — never flip this to True
    )
