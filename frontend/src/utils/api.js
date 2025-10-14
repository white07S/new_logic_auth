/**
 * API utilities for the application.
 *
 * Security improvements:
 * - No localStorage usage for auth data
 * - CSRF token automatically included in requests
 * - All auth state managed server-side
 * - Credentials included in all requests
 */

import axios from 'axios';
import {
  getFingerprint,
  clearAuthCache,
  refreshAuth,
  getCSRFToken
} from './auth';
import { API_BASE_URL } from './config';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Always send cookies
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor to add CSRF token
api.interceptors.request.use(
  async (config) => {
    // Add CSRF token for state-changing requests
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method.toUpperCase())) {
      const csrfToken = await getCSRFToken();
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling authentication failures
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      clearAuthCache();

      // Don't redirect if we're already on the home page
      if (window.location.hash !== '#/' && window.location.pathname !== '/') {
        window.location.href = '/#/';
      }
    }

    // Handle 403 Forbidden (CSRF failure)
    if (error.response?.status === 403) {
      const errorDetail = error.response.data?.detail || '';
      if (errorDetail.includes('CSRF')) {
        console.error('CSRF validation failed. Refreshing auth state...');
        // Refresh auth to get new CSRF token
        await refreshAuth();

        // Retry the original request once
        if (!error.config._retry) {
          error.config._retry = true;
          const csrfToken = await getCSRFToken();
          if (csrfToken) {
            error.config.headers['X-CSRF-Token'] = csrfToken;
          }
          return api(error.config);
        }
      }
    }

    // Handle 429 Too Many Requests
    if (error.response?.status === 429) {
      console.warn('Rate limit exceeded. Please slow down requests.');
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  /**
   * Start Azure device code flow
   *
   * @returns {Promise<object>} Session data with device code
   */
  startAuth: async () => {
    const response = await api.post('/api/authorize/start');
    return response.data;
  },

  /**
   * Check auth status
   *
   * @param {string} sessionId - Session ID from startAuth
   * @returns {Promise<object>} Auth status
   */
  checkAuthStatus: async (sessionId) => {
    const response = await api.get('/api/authorize/status', {
      params: { session_id: sessionId },
    });
    return response.data;
  },

  /**
   * Complete authorization
   *
   * @param {string} sessionId - Session ID from startAuth
   * @returns {Promise<object>} Success response (no sensitive data)
   */
  completeAuth: async (sessionId) => {
    const fingerprint = getFingerprint();
    const response = await api.post('/api/authorize/complete', {
      session_id: sessionId,
      fingerprint,
    });

    // Server returns minimal response, no sensitive data
    // Auth state is now managed server-side via cookies

    // Refresh auth cache after successful login
    await refreshAuth();

    return response.data;
  },

  /**
   * Logout current user
   *
   * @returns {Promise<void>}
   */
  logout: async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      // Clear local auth cache
      clearAuthCache();
    }
  },

  /**
   * Get current user info from server
   *
   * @returns {Promise<object>} User data
   */
  getCurrentUser: async () => {
    const response = await api.get('/api/me');
    return response.data;
  },

  /**
   * Check authentication status
   *
   * @returns {Promise<object>} Auth status with user data
   */
  checkAuth: async () => {
    const response = await api.get('/api/check-auth');
    return response.data;
  },

  /**
   * Get session information
   *
   * @returns {Promise<object>} Session details
   */
  getSessionInfo: async () => {
    const response = await api.get('/api/session/info');
    return response.data;
  },
};

// Admin API
export const adminAPI = {
  /**
   * Get all active sessions (admin only)
   *
   * @returns {Promise<object>} Sessions data
   */
  getAllSessions: async () => {
    const response = await api.get('/api/admin/sessions');
    return response.data;
  },
};

// User API
export const userAPI = {
  /**
   * Get user's devices/sessions
   *
   * @returns {Promise<object>} User devices data
   */
  getMyDevices: async () => {
    const response = await api.get('/api/me/devices');
    return response.data;
  },
};

// Test API (for RBAC testing)
export const testAPI = {
  /**
   * Test public endpoint
   *
   * @returns {Promise<object>} Public data
   */
  getPublic: async () => {
    const response = await api.get('/test/public');
    return response.data;
  },

  /**
   * Test user-protected endpoint
   *
   * @returns {Promise<object>} User data
   */
  getUserProtected: async () => {
    const response = await api.get('/test/user');
    return response.data;
  },

  /**
   * Test admin-protected endpoint
   *
   * @returns {Promise<object>} Admin data
   */
  getAdminProtected: async () => {
    const response = await api.get('/test/admin');
    return response.data;
  },
};

// Utility function to handle API errors
export const handleApiError = (error, defaultMessage = 'An error occurred') => {
  if (error.response) {
    // Server responded with error
    const message = error.response.data?.detail || error.response.data?.message || defaultMessage;
    const status = error.response.status;

    return {
      message,
      status,
      isNetworkError: false,
    };
  } else if (error.request) {
    // Request made but no response
    return {
      message: 'Network error - please check your connection',
      status: null,
      isNetworkError: true,
    };
  } else {
    // Request setup error
    return {
      message: error.message || defaultMessage,
      status: null,
      isNetworkError: false,
    };
  }
};

// Export default API instance for custom endpoints
export default api;
