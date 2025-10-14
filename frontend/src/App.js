import React, { useState, useEffect } from 'react';
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

  // Check auth state on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setAuthLoading(true);
        const isAuth = await isAuthenticated();
        const user = isAuth ? await getCurrentUser() : null;

        setAuthenticated(isAuth);
        setCurrentUser(user);
      } catch (error) {
        console.error('Auth check failed:', error);
        setAuthenticated(false);
        setCurrentUser(null);
      } finally {
        setAuthLoading(false);
      }
    };

    // Check immediately
    checkAuth();

    // Set up periodic auth check (every 30 seconds to sync with cache)
    const intervalId = setInterval(checkAuth, 30000);

    // Check on visibility change (when tab becomes active)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkAuth();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Note: We no longer listen to storage events since we don't use localStorage
    // Cross-tab logout will be handled by the server invalidating the session

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const showSnackbar = (message, type = 'info') => {
    setSnackbar({ message, type });
  };

  const hideSnackbar = () => {
    setSnackbar(null);
  };

  const handleAuthChange = async () => {
    try {
      // Force refresh auth state from server
      await refreshAuth();

      const isAuth = await isAuthenticated();
      const user = isAuth ? await getCurrentUser() : null;

      console.log('Auth changed:', { authenticated: isAuth, user });
      setAuthenticated(isAuth);
      setCurrentUser(user);
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