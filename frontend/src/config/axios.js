import axios from 'axios';

// Configure axios base URL for production
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || '';

if (API_BASE_URL) {
  axios.defaults.baseURL = API_BASE_URL;
}

export default axios;
