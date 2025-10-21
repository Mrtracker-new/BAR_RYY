import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backendUrl = process.env.VITE_BACKEND_URL || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/upload': backendUrl,
      '/seal': backendUrl,
      '/download': backendUrl,
      '/decrypt': backendUrl,
      '/decrypt-upload': backendUrl,
      '/info': backendUrl,
      '/api': backendUrl
    }
  },
  preview: {
    port: process.env.PORT || 5173,
    host: true
  }
})
