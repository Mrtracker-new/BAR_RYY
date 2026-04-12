import axios from 'axios';

// Configure axios base URL
// In development: use proxy (empty string = relative URLs)
// In production: use VITE_BACKEND_URL from env
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || '';

if (API_BASE_URL) {
  axios.defaults.baseURL = API_BASE_URL;
}

// ─── CSRF protection ────────────────────────────────────────────────────────
// The backend's CSRFGuard middleware requires X-Requested-With on every
// state-mutating request (POST / PUT / PATCH / DELETE).  Setting it here as a
// global default means no individual call site needs to remember to add it.
//
// withCredentials stays false — the API uses no cookies, so there are no
// credentials to send.  Enabling it without a matching allow_credentials=True
// on the server would cause every CORS pre-flight to fail.
// ────────────────────────────────────────────────────────────────────────────
axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
axios.defaults.withCredentials = false;

// Vite proxy handles /api, /upload, /seal, etc in development
// See vite.config.js for proxy configuration

export default axios;

