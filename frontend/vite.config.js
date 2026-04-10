import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backendUrl = process.env.VITE_BACKEND_URL || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // listen on 0.0.0.0 so phones on the same Wi‑Fi can reach it
    proxy: {
      // ── Core file operations ──────────────────────────────────────────────
      '/upload':          { target: backendUrl, changeOrigin: true },
      '/seal':            { target: backendUrl, changeOrigin: true },
      '/download':        { target: backendUrl, changeOrigin: true },
      '/info':            { target: backendUrl, changeOrigin: true },
      '/storage-info':    { target: backendUrl, changeOrigin: true },

      // ── Server-side file access & file sharing ────────────────────────────
      // The /share namespace is dual-purpose:
      //   - GET  /share/:token  → React Router SPA page (served as index.html)
      //   - POST /share/:token  → FastAPI backend (decrypt & stream the file)
      // The bypass function routes based on HTTP method so both work correctly.
      '/share': {
        target: backendUrl,
        changeOrigin: true,
        bypass(req) {
          // Only proxy POST (and OPTIONS preflight) to the backend.
          // All other methods (GET, HEAD) are React Router navigations — serve the SPA.
          if (req.method !== 'POST' && req.method !== 'OPTIONS') {
            return '/index.html';
          }
        }
      },

      // ── Client-side / download-mode decrypt ──────────────────────────────
      '/decrypt':         { target: backendUrl, changeOrigin: true },
      '/decrypt-upload':  { target: backendUrl, changeOrigin: true },

      // ── 2FA / OTP flow ────────────────────────────────────────────────────
      '/check-2fa':       { target: backendUrl, changeOrigin: true },
      '/request-otp':     { target: backendUrl, changeOrigin: true },
      '/verify-otp':      { target: backendUrl, changeOrigin: true },

      // ── Analytics ─────────────────────────────────────────────────────────
      '/analytics':       { target: backendUrl, changeOrigin: true },

      // ── Generic API namespace ─────────────────────────────────────────────
      '/api':             { target: backendUrl, changeOrigin: true },
    }
  },
  preview: {
    port: process.env.PORT || 5173,
    host: true
  }
})
