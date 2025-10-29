import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import Snackbar from './components/Snackbar';
import LoginModal from './components/LoginModal';
import Home from './pages/Home';
import Page1 from './pages/Page1';
import Page2 from './pages/Page2';
import { isAuthenticated, getCurrentUser } from './utils/auth';
import './App.css';

function App() {
  const [snackbar, setSnackbar] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const syncAuthState = useCallback(
    async ({ forceRefresh = false, showLoading = false } = {}) => {
      try {
        if (showLoading) {
          setAuthLoading(true);
        }

        const isAuth = await isAuthenticated({ forceRefresh });
        const user = isAuth ? await getCurrentUser({ forceRefresh }) : null;

        setAuthenticated(isAuth);
        setCurrentUser(user);
      } catch (error) {
        console.error('Auth sync failed:', error);
        setAuthenticated(false);
        setCurrentUser(null);
      } finally {
        if (showLoading) {
          setAuthLoading(false);
        }
      }
    },
    []
  );

  // Initial auth check on mount
  useEffect(() => {
    syncAuthState({ showLoading: true });
  }, [syncAuthState]);

  const AccessDenied = ({ requiredRoles, reason }) => {
    const navigate = useNavigate();
    const rolesArray = requiredRoles || [];
    const hasRoleRequirement = rolesArray.length > 0;
    const defaultMessage = hasRoleRequirement
      ? `This page requires one of the following roles: ${rolesArray.join(', ')}.`
      : 'You must be signed in to view this page.';
    const primaryMessage = reason || defaultMessage;

    return (
      <div className="min-h-[calc(100vh-64px)] bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-2xl font-bold">!</span>
          </div>
          <h2 className="text-2xl font-bold text-black mb-2">Access Restricted</h2>
          <p className="text-gray-600 mb-4">{primaryMessage}</p>
          {reason && hasRoleRequirement && (
            <p className="text-gray-500 mb-4">{defaultMessage}</p>
          )}
          {currentUser && (
            <div className="bg-gray-50 rounded p-4 mb-6 text-left">
              <p className="text-sm text-gray-600 mb-1">Current User:</p>
              <p className="text-sm font-medium text-black">{currentUser.email}</p>
              <p className="text-sm text-gray-600 mt-2 mb-1">Your Roles:</p>
              <div className="flex flex-wrap gap-2">
                {currentUser.roles?.map((role) => (
                  <span
                    key={role}
                    className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs"
                  >
                    {role}
                  </span>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={() => navigate('/')}
            className="bg-red-600 text-white px-6 py-3 rounded hover:bg-red-700 transition-colors font-medium"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  };

  const NotAuthenticated = ({ pageName, onAuthChange }) => {
    const navigate = useNavigate();
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

    const handleLoginSuccess = (userData) => {
      onAuthChange();
      setIsLoginModalOpen(false);
      // Page will automatically re-render with authenticated content
    };

    const handleLoginError = (message) => {
      // Error handling is done in the LoginModal itself
      console.error('Login error:', message);
    };

    return (
      <>
        <div className="min-h-[calc(100vh-64px)] bg-gray-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center max-w-md">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-black mb-2">Login Required</h2>
            <p className="text-gray-600 mb-2">
              You are not currently logged in.
            </p>
            <p className="text-gray-600 mb-6">
              {pageName ? `Please sign in to access ${pageName}.` : 'Please sign in to access this page.'}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="w-full bg-red-600 text-white px-6 py-3 rounded hover:bg-red-700 transition-colors font-medium"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full bg-gray-200 text-gray-700 px-6 py-3 rounded hover:bg-gray-300 transition-colors font-medium"
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>

        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onLoginSuccess={handleLoginSuccess}
          onLoginError={handleLoginError}
        />
      </>
    );
  };

  const ProtectedRoute = ({ children, requiredRoles = [], pageName }) => {
    if (!authenticated) {
      return <NotAuthenticated pageName={pageName} onAuthChange={syncAuthState} />;
    }

    if (!currentUser) {
      return (
        <AccessDenied
          requiredRoles={requiredRoles}
          reason="Your session could not be verified. Please sign in again."
        />
      );
    }

    const userRoles = currentUser.roles || [];

    if (userRoles.length === 0) {
      return (
        <AccessDenied
          requiredRoles={requiredRoles}
          reason="Your account does not have any roles assigned. Please contact an administrator."
        />
      );
    }

    if (
      requiredRoles.length > 0 &&
      !requiredRoles.some((role) => userRoles.includes(role))
    ) {
      return (
        <AccessDenied
          requiredRoles={requiredRoles}
          reason="You do not have the necessary permissions for this page."
        />
      );
    }

    return children;
  };

  // Background polling only when authenticated
  useEffect(() => {
    if (!authenticated) {
      return;
    }

    let isActive = true;

    const pollAuth = async () => {
      if (!isActive) return;
      await syncAuthState({ forceRefresh: true });
    };

    // Run an immediate refresh so session info stays current
    pollAuth();

    const intervalId = setInterval(pollAuth, 30000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        pollAuth();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isActive = false;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authenticated, syncAuthState]);

  const showSnackbar = (message, type = 'info') => {
    setSnackbar({ message, type });
  };

  const hideSnackbar = () => {
    setSnackbar(null);
  };

  const handleAuthChange = async () => {
    try {
      await syncAuthState({ forceRefresh: true });
    } catch (error) {
      console.error('Failed to refresh auth:', error);
      setAuthenticated(false);
      setCurrentUser(null);
    }
  };

  // Show loading state while checking initial auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <div className="min-h-screen bg-gray-50">
        <Header
          onShowSnackbar={showSnackbar}
          authenticated={authenticated}
          currentUser={currentUser}
          onAuthChange={handleAuthChange}
        />
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute pageName="Home">
                <Home authenticated={authenticated} currentUser={currentUser} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/page1"
            element={
              <ProtectedRoute pageName="Page 1">
                <Page1 currentUser={currentUser} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/page2"
            element={
              <ProtectedRoute pageName="Page 2" requiredRoles={['admin']}>
                <Page2 currentUser={currentUser} />
              </ProtectedRoute>
            }
          />
        </Routes>
        {snackbar && (
          <Snackbar
            message={snackbar.message}
            type={snackbar.type}
            onClose={hideSnackbar}
          />
        )}
      </div>
    </HashRouter>
  );
}

export default App;
