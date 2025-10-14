import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
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
          <Route path="/page1" element={<Page1 onShowSnackbar={showSnackbar} />} />
          <Route path="/page2" element={<Page2 onShowSnackbar={showSnackbar} />} />
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
