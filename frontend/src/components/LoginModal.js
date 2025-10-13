import React, { useState, useEffect } from 'react';
import { X, Copy, CheckCircle } from 'lucide-react';
import { authAPI } from '../utils/api';

const LoginModal = ({ isOpen, onClose, onLoginSuccess, onError }) => {
  const [step, setStep] = useState('idle'); // idle, loading, code, polling, success, error
  const [userCode, setUserCode] = useState('');
  const [verificationUri, setVerificationUri] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setStep('idle');
      setUserCode('');
      setVerificationUri('');
      setCopied(false);
    }
  }, [isOpen]);

  const startLogin = async () => {
    setStep('loading');
    try {
      const data = await authAPI.startAuth();
      setUserCode(data.user_code);
      setVerificationUri(data.verification_uri);
      setStep('code');

      // Start polling for auth status
      pollAuthStatus(data.session_id);
    } catch (error) {
      setStep('error');
      onError(error.response?.data?.detail || 'Failed to start authentication');
    }
  };

  const pollAuthStatus = async (sid) => {
    setStep('polling');
    const maxAttempts = 60; // Poll for 2 minutes
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setStep('error');
        onError('Authentication timeout. Please try again.');
        return;
      }

      try {
        const status = await authAPI.checkAuthStatus(sid);

        if (status.status === 'completed') {
          if (status.authorized) {
            // Complete the auth flow
            try {
              const result = await authAPI.completeAuth(sid);
              setStep('success');
              // Trigger success callback immediately, then close
              onLoginSuccess(result.user);
              setTimeout(() => {
                onClose();
              }, 800);
              return; // Stop polling
            } catch (error) {
              setStep('error');
              onError(error.response?.data?.detail || 'Failed to complete authentication');
              return;
            }
          } else {
            setStep('error');
            onError('User not authorized. Please contact administrator.');
          }
        } else if (status.status === 'error' || status.status === 'timeout') {
          setStep('error');
          onError(status.message || 'Authentication failed');
        } else {
          // Continue polling
          attempts++;
          setTimeout(poll, 2000);
        }
      } catch (error) {
        setStep('error');
        onError(error.response?.data?.detail || 'Authentication failed');
      }
    };

    poll();
  };

  const copyCode = () => {
    navigator.clipboard.writeText(userCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openVerificationUrl = () => {
    window.open(verificationUri, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-black">Sign In</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-black transition-colors p-1 hover:bg-gray-100 rounded"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          {step === 'idle' && (
            <div className="text-center">
              <p className="text-gray-600 mb-6">
                Sign in with your Azure account to access protected resources.
              </p>
              <button
                onClick={startLogin}
                className="w-full bg-red-600 text-white py-3 px-4 rounded hover:bg-red-700 transition-colors font-medium"
              >
                Sign in with Azure
              </button>
            </div>
          )}

          {step === 'loading' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-600 border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-600">Initializing authentication...</p>
            </div>
          )}

          {(step === 'code' || step === 'polling') && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-gray-600 mb-4">
                  Enter the following code in your browser:
                </p>
                <div className="flex items-center gap-2 justify-center mb-4">
                  <div className="bg-gray-100 px-6 py-3 rounded font-mono text-2xl font-bold text-black tracking-wider">
                    {userCode}
                  </div>
                  <button
                    onClick={copyCode}
                    className="p-2 hover:bg-gray-100 rounded transition-colors"
                    title="Copy code"
                  >
                    {copied ? <CheckCircle size={20} className="text-green-600" /> : <Copy size={20} />}
                  </button>
                </div>
                <button
                  onClick={openVerificationUrl}
                  className="w-full bg-red-600 text-white py-3 px-4 rounded hover:bg-red-700 transition-colors font-medium mb-4"
                >
                  Open Authentication Page
                </button>
                {step === 'polling' && (
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-600 border-t-transparent"></div>
                    <span>Waiting for authentication...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <CheckCircle size={48} className="text-green-600 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Authentication successful!</p>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center">
              <p className="text-red-600 mb-4">Authentication failed</p>
              <button
                onClick={() => {
                  setStep('idle');
                  setUserCode('');
                  setVerificationUri('');
                }}
                className="w-full bg-red-600 text-white py-3 px-4 rounded hover:bg-red-700 transition-colors font-medium"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
