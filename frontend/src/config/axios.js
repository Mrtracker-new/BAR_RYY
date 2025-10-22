import axios from 'axios';

// Configure axios base URL
// In development: use proxy (empty string = relative URLs)
// In production: use VITE_BACKEND_URL from Railway env
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || '';

if (API_BASE_URL) {
  axios.defaults.baseURL = API_BASE_URL;
}

// Vite proxy handles /api, /upload, /seal, etc in development
// See vite.config.js for proxy configuration

export default axios;
