import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import Snackbar from './components/Snackbar';
import Home from './pages/Home';
import Page1 from './pages/Page1';
import Page2 from './pages/Page2';
import { isAuthenticated, getCurrentUser, refreshAuth } from './utils/auth';
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

        if (forceRefresh) {
          await refreshAuth();
        }

        const isAuth = await isAuthenticated();
        const user = isAuth ? await getCurrentUser() : null;

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

  const AccessDenied = ({ requiredRoles }) => {
    const navigate = useNavigate();
    return (
      <div className="min-h-[calc(100vh-64px)] bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-2xl font-bold">!</span>
          </div>
          <h2 className="text-2xl font-bold text-black mb-2">Access Restricted</h2>
          <p className="text-gray-600 mb-4">
            {requiredRoles && requiredRoles.length > 0
              ? `This page requires one of the following roles: ${requiredRoles.join(', ')}.`
              : 'You must be signed in to view this page.'}
          </p>
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

  const ProtectedRoute = ({ children, requiredRoles = [] }) => {
    if (!authenticated) {
      return <Navigate to="/" replace />;
    }

    if (!currentUser) {
      return <AccessDenied requiredRoles={requiredRoles} />;
    }

    if (
      requiredRoles.length > 0 &&
      !requiredRoles.some((role) => currentUser.roles?.includes(role))
    ) {
      return <AccessDenied requiredRoles={requiredRoles} />;
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
      await syncAuthState();
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
          <Route path="/" element={<Home authenticated={authenticated} />} />
          <Route
            path="/page1"
            element={
              <ProtectedRoute>
                <Page1 currentUser={currentUser} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/page2"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
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
