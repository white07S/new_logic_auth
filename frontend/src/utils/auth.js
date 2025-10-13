// Generate browser fingerprint
export const generateFingerprint = () => {
  const stored = localStorage.getItem('fingerprint');
  if (stored) return stored;

  const fingerprint = `${navigator.userAgent}-${navigator.language}-${window.screen.width}x${window.screen.height}-${new Date().getTime()}`;
  const hash = btoa(fingerprint).substring(0, 32);
  localStorage.setItem('fingerprint', hash);
  return hash;
};

// Get fingerprint
export const getFingerprint = () => {
  let fingerprint = localStorage.getItem('fingerprint');
  if (!fingerprint) {
    fingerprint = generateFingerprint();
  }
  return fingerprint;
};

// Check if user is authenticated (only check localStorage since cookies are httpOnly)
export const isAuthenticated = () => {
  const user = getCurrentUser();
  if (!user) {
    return false;
  }

  if (user.token_expires_at) {
    const expiresAt = new Date(user.token_expires_at);
    if (Number.isFinite(expiresAt.getTime()) && expiresAt <= new Date()) {
      clearAuth();
      console.log('Auth check: session expired, clearing cached user');
      return false;
    }
  }

  console.log('Auth check:', { hasUser: true, user });
  return true;
};

// Get current user from localStorage
export const getCurrentUser = () => {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch (e) {
    return null;
  }
};

// Set current user in localStorage
export const setCurrentUser = (user) => {
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  } else {
    localStorage.removeItem('user');
  }
};

// Clear authentication data
export const clearAuth = () => {
  localStorage.removeItem('user');
  // Cookies are httpOnly and will be cleared by the server
};
