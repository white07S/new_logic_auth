import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, LogOut, User } from 'lucide-react';
import { authAPI } from '../utils/api';
import LoginModal from './LoginModal';

const Header = ({ onShowSnackbar, authenticated, currentUser, onAuthChange }) => {
  const navigate = useNavigate();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const handleLoginSuccess = (userData) => {
    onAuthChange();
    onShowSnackbar('Login successful!', 'success');
    setIsLoginModalOpen(false);
  };

  const handleLoginError = (message) => {
    onShowSnackbar(message, 'error');
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      onAuthChange();
      onShowSnackbar('Logged out successfully', 'success');
      navigate('/');
    } catch (error) {
      onShowSnackbar('Logout failed', 'error');
    }
  };

  return (
    <>
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <button
                onClick={() => navigate('/')}
                className="text-2xl font-bold text-red-600 hover:text-red-700 transition-colors"
              >
                AuthApp
              </button>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex space-x-8">
              <button
                onClick={() => navigate('/')}
                className="text-gray-700 hover:text-red-600 px-3 py-2 text-sm font-medium transition-colors"
              >
                Home
              </button>
              <button
                onClick={() => navigate('/page1')}
                className="text-gray-700 hover:text-red-600 px-3 py-2 text-sm font-medium transition-colors"
              >
                Page 1
              </button>
              <button
                onClick={() => navigate('/page2')}
                className="text-gray-700 hover:text-red-600 px-3 py-2 text-sm font-medium transition-colors"
              >
                Page 2
              </button>
            </nav>

            {/* Auth Section */}
            <div className="flex items-center gap-4">
              {authenticated ? (
                <>
                  <div className="hidden sm:flex items-center gap-2 text-sm text-gray-700">
                    <User size={16} />
                    <span>{currentUser?.username || currentUser?.email}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors text-sm font-medium"
                  >
                    <LogOut size={16} />
                    <span>Logout</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors text-sm font-medium"
                >
                  <LogIn size={16} />
                  <span>Login</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        onError={handleLoginError}
      />
    </>
  );
};

export default Header;
