import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Snackbar from './components/Snackbar';
import Home from './pages/Home';
import Page1 from './pages/Page1';
import Page2 from './pages/Page2';
import { isAuthenticated, getCurrentUser } from './utils/auth';
import './App.css';

function App() {
  const [snackbar, setSnackbar] = useState(null);
  const [authenticated, setAuthenticated] = useState(isAuthenticated());
  const [currentUser, setCurrentUser] = useState(getCurrentUser());

  // Check auth state on mount and when hash changes
  useEffect(() => {
    const checkAuth = () => {
      setAuthenticated(isAuthenticated());
      setCurrentUser(getCurrentUser());
    };

    // Check immediately
    checkAuth();

    // Listen for storage changes (for logout in other tabs)
    window.addEventListener('storage', checkAuth);

    return () => {
      window.removeEventListener('storage', checkAuth);
    };
  }, []);

  const showSnackbar = (message, type = 'info') => {
    setSnackbar({ message, type });
  };

  const hideSnackbar = () => {
    setSnackbar(null);
  };

  const handleAuthChange = () => {
    const authStatus = isAuthenticated();
    const user = getCurrentUser();
    console.log('Auth changed:', { authStatus, user });
    setAuthenticated(authStatus);
    setCurrentUser(user);
  };

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
