# BAR Development & Deployment Guide

[Back to README](../README.md) | [Architecture](ARCHITECTURE.md) | [Cryptography](CRYPTOGRAPHY.md) | [API Specification](API_SPECIFICATION.md) | [Operations](OPERATIONS.md)

Engineering guide for local development, reverse-proxy topologies, testing, and production deployment of the BAR (Burn After Reading) platform.

---

## 1. Prerequisites & Tooling

* **Python:** 3.10 or higher.
* **Node.js:** 18.0.0 LTS or higher.
* **Package Managers:** `pip` (Python) and `npm` (Node).
* **Virtual Environment:** Python `venv` recommended for isolated dependency management.

---

## 2. Environment Variables Configuration

Create a `.env` file inside `backend/` using `backend/.env.example` as a template:

| Variable | Type | Default | Purpose |
| :--- | :--- | :--- | :--- |
| `APP_NAME` | string | `"BAR Web"` | Application branding in logs and OpenAPI metadata. |
| `ENVIRONMENT` | string | `"development"` | Environment flag (`development`, `staging`, `production`). |
| `IS_PRODUCTION` | boolean | `false` | When `true`, restricts CORS to production domains and tightens proxy CIDRs. |
| `HOST` | string | `"0.0.0.0"` | Network interface for the Uvicorn ASGI server. |
| `PORT` | integer | `8000` | Port for the Uvicorn ASGI server. |
| `DATABASE_URL` | string | `"sqlite:///bar_files.db"` | Database connection string (SQLite or PostgreSQL). |
| `UPLOAD_DIR` | path | `"./uploads"` | Directory for staged temporary files before sealing. |
| `GENERATED_DIR` | path | `"./generated"` | Directory for sealed on-disk `.bar` containers. |
| `MAX_FILE_SIZE` | integer | `104857600` | Maximum file upload size in bytes (default: 100 MB). |
| `ALLOWED_ORIGINS` | string | `"http://localhost:5173"` | Comma-separated list of permitted CORS origins. |
| `TRUSTED_PROXY_CIDRS` | string | Render defaults | Comma-separated CIDR blocks trusted for `X-Forwarded-For` parsing. Set to `none` to disable. |
| `CHAT_PIN_MAX_FAILURES` | integer | `3` | Max failed creator PIN attempts before IP is blocked. |
| `CHAT_PIN_WINDOW_SECS` | float | `600.0` | Sliding window in seconds for creator PIN brute-force defense. |

---

## 3. Local Development Setup

### 3.1 Automated Startup (Windows)
```cmd
# Run initial dependency setup
setup.bat

# Launch backend and frontend development servers
start.bat
```

### 3.2 Manual Startup (POSIX / macOS / Linux)

#### Backend Service
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python run.py
```
* The backend launches at `http://localhost:8000`.
* Interactive OpenAPI documentation is accessible at `http://localhost:8000/docs`.

#### Frontend Application
```bash
cd frontend
npm install
npm run dev
```
* The frontend development server launches at `http://localhost:5173`.

---

## 4. Vite Reverse-Proxy Topology

To enable seamless single-page application (SPA) routing alongside backend API and WebSocket endpoints on a single origin, `frontend/vite.config.js` implements a custom proxy table:

```javascript
// Excerpt from frontend/vite.config.js
proxy: {
  '/upload': { target: backendUrl, changeOrigin: true },
  '/seal': { target: backendUrl, changeOrigin: true },
  '/share': {
    target: backendUrl,
    changeOrigin: true,
    bypass(req) {
      // Proxy POST/OPTIONS to backend; route GET/HEAD to React Router SPA (index.html)
      if (req.method !== 'POST' && req.method !== 'OPTIONS') {
        return '/index.html';
      }
    }
  },
  '/chat': {
    target: backendUrl,
    changeOrigin: true,
    ws: true,
    bypass(req) {
      const isWs = req.headers['upgrade'] === 'websocket';
      const isPost = req.method === 'POST';
      const isInfoRequest = /^\/chat\/[^/]+\/info(\?.*)?$/.test(req.url);
      if (!isWs && !isPost && !isInfoRequest) return '/index.html';
    }
  }
}
```

* **Method-Based Bypassing:** Paths such as `/share/:token` require different handling depending on the HTTP verb: `GET` loads the client-side decryption UI, while `POST` submits the password to the backend for stream decryption.
* **WebSocket Upgrades:** The `/chat` proxy configures `ws: true` to forward `Upgrade: websocket` headers directly to the ASGI server.

---

## 5. Backend Lifespan Architecture

The backend utilizes FastAPI's unified lifespan context manager (`@asynccontextmanager async def lifespan(app: FastAPI)`):

1. **Database Schema Verification:** `database.init_database()` creates or migrates SQLite/PostgreSQL schemas synchronously before accepting requests.
2. **Background Cleanup Loop:** `cleanup.run_cleanup_loop()` is spawned as an asynchronous task and registered with `core.concurrency.track_background_task` to prevent garbage collection.
3. **HTTP Client Management:** A shared `httpx.AsyncClient` pool is initialized for outbound webhook deliveries and geolocation analytics.
4. **Graceful Teardown:** Upon SIGTERM/SIGINT, the cleanup loop is cancelled, HTTP client connections are drained, and database connections are safely closed.

---

## 6. Testing & Quality Assurance

### 6.1 Backend Tests
Run the comprehensive test suite with `pytest`:
```bash
cd backend
pytest tests/ -v
```

### 6.2 Frontend Production Build
Validate the client-side bundle and asset compilation:
```bash
cd frontend
npm run build
```
Compiled assets will be emitted to `frontend/dist/`.

---

## 7. Production Deployment Architecture

### 7.1 Backend Containerization
* **ASGI Server:** Uvicorn running with a single worker process:
  ```bash
  uvicorn app:app --host 0.0.0.0 --port 8000 --workers 1
  ```
  > Note: Because Burn Chat maintains room state in memory, multi-worker deployments require sticky sessions or an external pub/sub layer.

### 7.2 Frontend Static CDN
* Deploy `frontend/dist/` to a global edge network (e.g., Vercel, Netlify, Cloudflare Pages).
* Configure `VITE_BACKEND_URL` in the build environment to target the production API domain.
* Configure SPA fallback rewrite rules: all non-asset requests must resolve to `index.html`.
