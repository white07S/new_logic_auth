import axios from 'axios';
import { getFingerprint, setCurrentUser, clearAuth, getCurrentUser as getStoredUser } from './auth';

const API_BASE_URL = 'http://localhost:8000';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth API
export const authAPI = {
  // Start Azure device code flow
  startAuth: async () => {
    const response = await api.post('/api/authorize/start');
    return response.data;
  },

  // Check auth status
  checkAuthStatus: async (sessionId) => {
    const response = await api.get('/api/authorize/status', {
      params: { session_id: sessionId },
    });
    return response.data;
  },

  // Complete authorization
  completeAuth: async (sessionId) => {
    const fingerprint = getFingerprint();
    const response = await api.post('/api/authorize/complete', {
      session_id: sessionId,
      fingerprint,
    });
    if (response.data.user) {
      const sessionUser = {
        ...response.data.user,
        roles: response.data.roles || response.data.user.roles || [],
        token_expires_at: response.data.token_expires_at,
      };
      setCurrentUser(sessionUser);
      console.log('User set in localStorage:', sessionUser);
      console.log('Cookies after auth:', document.cookie);
    }
    return response.data;
  },

  // Logout
  logout: async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      clearAuth();
    }
  },

  // Get current user
  getCurrentUser: async () => {
    const response = await api.get('/api/me');
    // Update localStorage with fresh user data
    if (response.data) {
      const existing = getStoredUser();
      const mergedUser = {
        ...(existing || {}),
        ...response.data,
      };
      setCurrentUser(mergedUser);
      console.log('Fresh user data from API:', mergedUser);
    }
    return response.data;
  },

  // Check authentication
  checkAuth: async () => {
    const response = await api.get('/api/check-auth');
    return response.data;
  },
};

// Response interceptor for handling authentication failures
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAuth();
      window.location.href = '/#/';
    }

    return Promise.reject(error);
  }
);

export default api;
