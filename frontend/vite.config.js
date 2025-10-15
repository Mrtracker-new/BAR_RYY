import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/upload': 'http://localhost:8000',
      '/seal': 'http://localhost:8000',
      '/download': 'http://localhost:8000',
      '/decrypt': 'http://localhost:8000',
      '/decrypt-upload': 'http://localhost:8000',
      '/info': 'http://localhost:8000',
      '/share': 'http://localhost:8000'
    }
  }
})
