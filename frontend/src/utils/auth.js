/**
 * Authentication utilities for the application.
 *
 * Security improvements:
 * - No localStorage usage for sensitive data
 * - All auth state is fetched from server
 * - Fingerprint generated per session without persistence
 * - CSRF token handled automatically
 */

import { API_BASE_URL } from './config';

const buildApiUrl = (path) => new URL(path, API_BASE_URL).toString();

// In-memory cache for auth state (NOT persisted)
let authCache = {
  user: null,
  csrfToken: null,
  lastChecked: null,
  checkPromise: null
};

// Cache duration in milliseconds (30 seconds)
const CACHE_DURATION = 30000;

/**
 * Generate browser fingerprint for this session.
 * Not persisted to localStorage for security.
 *
 * @returns {string} Browser fingerprint hash
 */
export const generateFingerprint = () => {
  // Create a unique fingerprint based on browser characteristics
  const components = [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    navigator.hardwareConcurrency || 0,
    window.screen.width,
    window.screen.height,
    window.screen.colorDepth,
    new Date().getTimezoneOffset(),
    // Add a random component for uniqueness per session
    Math.random().toString(36).substring(2, 15)
  ];

  const fingerprint = components.join('-');

  // Create a hash of the fingerprint
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Convert to base64 and limit length
  return btoa(Math.abs(hash).toString()).substring(0, 32);
};

/**
 * Get fingerprint for current session.
 * Generates new one each session for security.
 *
 * @returns {string} Browser fingerprint
 */
let sessionFingerprint = null;
export const getFingerprint = () => {
  if (!sessionFingerprint) {
    sessionFingerprint = generateFingerprint();
  }
  return sessionFingerprint;
};

/**
 * Check if user is authenticated by calling the server.
 * Uses in-memory cache to reduce API calls.
 *
 * @returns {Promise<boolean>} True if authenticated
 */
export const isAuthenticated = async (options = {}) => {
  const { forceRefresh = false } = options;
  try {
    const authData = await checkAuthWithServer(forceRefresh);
    return authData && authData.authenticated === true;
  } catch (error) {
    console.error('Authentication check failed:', error);
    return false;
  }
};

/**
 * Get current user from server.
 * Uses cached data if available and fresh.
 *
 * @returns {Promise<object|null>} User object or null
 */
export const getCurrentUser = async (options = {}) => {
  const { forceRefresh = false } = options;
  try {
    const authData = await checkAuthWithServer(forceRefresh);
    return authData ? authData.user : null;
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
};

/**
 * Get CSRF token for API requests.
 *
 * @returns {Promise<string|null>} CSRF token or null
 */
export const getCSRFToken = async (forceRefresh = false) => {
  try {
    const authData = await checkAuthWithServer(forceRefresh);
    return authData ? authData.csrf_token : null;
  } catch (error) {
    console.error('Failed to get CSRF token:', error);
    return null;
  }
};

/**
 * Check authentication status with the server.
 * Implements caching to reduce API calls.
 *
 * @param {boolean} forceRefresh - Force refresh bypassing cache
 * @returns {Promise<object|null>} Auth data from server
 */
export const checkAuthWithServer = async (forceRefresh = false) => {
  // Return cached data if fresh and not forcing refresh
  if (!forceRefresh && authCache.lastChecked) {
    const age = Date.now() - authCache.lastChecked;
    if (age < CACHE_DURATION) {
      return {
        authenticated: !!authCache.user,
        user: authCache.user,
        csrf_token: authCache.csrfToken
      };
    }
  }

  // If a check is already in progress, wait for it
  if (authCache.checkPromise) {
    return authCache.checkPromise;
  }

  // Start new check
  authCache.checkPromise = performAuthCheck();

  try {
    const result = await authCache.checkPromise;
    return result;
  } finally {
    authCache.checkPromise = null;
  }
};

/**
 * Perform actual authentication check with server.
 *
 * @returns {Promise<object|null>} Auth data from server
 */
const performAuthCheck = async () => {
  try {
    const response = await fetch(buildApiUrl('/api/check-auth'), {
      method: 'GET',
      credentials: 'include', // Include cookies
      headers: {
        'Accept': 'application/json',
      }
    });

    if (response.ok) {
      const data = await response.json();

      // Update cache
      authCache.user = data.user || null;
      authCache.csrfToken = data.csrf_token || null;
      authCache.lastChecked = Date.now();

      return data;
    } else if (response.status === 401) {
      // Not authenticated
      clearAuthCache();
      return null;
    } else {
      console.error('Auth check failed with status:', response.status);
      return null;
    }
  } catch (error) {
    console.error('Auth check network error:', error);
    return null;
  }
};

/**
 * Clear authentication cache.
 * Called after logout or when auth expires.
 */
export const clearAuthCache = () => {
  authCache = {
    user: null,
    csrfToken: null,
    lastChecked: null,
    checkPromise: null
  };
  sessionFingerprint = null;
};

/**
 * Clear authentication data (logout).
 * This is now handled server-side via logout endpoint.
 */
export const clearAuth = () => {
  clearAuthCache();
  // Server will clear HttpOnly cookies
};

/**
 * Force refresh authentication status.
 * Useful after login/logout operations.
 *
 * @returns {Promise<object|null>} Fresh auth data
 */
export const refreshAuth = async () => {
  return checkAuthWithServer(true);
};

/**
 * Check if user has specific role(s).
 *
 * @param {string|string[]} roles - Role(s) to check
 * @returns {Promise<boolean>} True if user has role(s)
 */
export const hasRole = async (roles) => {
  const user = await getCurrentUser();
  if (!user || !user.roles) return false;

  const requiredRoles = Array.isArray(roles) ? roles : [roles];
  return requiredRoles.some(role => user.roles.includes(role));
};

/**
 * Fetch session details for debugging/diagnostics.
 *
 * @returns {Promise<object|null>} Session metadata or null if unavailable
 */
export const getSessionDetails = async () => {
  try {
    const response = await fetch(buildApiUrl('/api/session/info'), {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'X-CSRF-Token': (await getCSRFToken()) || ''
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      sessionId: data.session_id,
      createdAt: data.created_at,
      lastSeenAt: data.last_seen_at,
      azureTenantId: data.azure_tenant_id,
      azureConfigDir: data.azure_config_dir,
      userIdentifier: data.user_identifier,
    };
  } catch (error) {
    console.error('Failed to get session details:', error);
    return null;
  }
};

// Utility function to format auth state for debugging (no sensitive data)
export const getAuthDebugInfo = async () => {
  const user = await getCurrentUser();
  const session = await getSessionDetails();

  return {
    authenticated: !!user,
    hasUser: !!user,
    userEmail: user?.email ? `${user.email.substring(0, 3)}***` : null,
    roles: user?.roles || [],
    sessionId: session?.sessionId || null,
    lastSeenAt: session?.lastSeenAt || null,
    azureConfigDir: session?.azureConfigDir || null,
    cacheAge: authCache.lastChecked ? Date.now() - authCache.lastChecked : null
  };
};
