import React, { useState, useEffect } from 'react';
import { Shield, Clock, Fingerprint, RefreshCw } from 'lucide-react';
import { authAPI } from '../utils/api';

const formatTimeRemaining = (isoExpiry) => {
  if (!isoExpiry) return 'Unknown';
  const expiresAt = new Date(isoExpiry);
  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();
  if (diffMs <= 0) return 'Expired';

  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'}`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  const remainingMinutes = diffMinutes % 60;
  if (diffHours < 24) {
    return `${diffHours}h ${remainingMinutes}m`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'}`;
};

const TokenStatus = () => {
  const [sessionInfo, setSessionInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSessionInfo = async () => {
    try {
      setError(null);
      // Fetch session info from server
      const data = await authAPI.getSessionInfo();
      setSessionInfo({
        expiresAt: data.expires_at,
        createdAt: data.created_at,
        lastUsedAt: data.last_used_at,
        sessionId: data.session_id,
        deviceId: data.device_id,
        rotated: data.rotated,
        fingerprintBound: true, // Always true in new system
      });
    } catch (err) {
      console.error('Failed to fetch session info:', err);
      // If 401, user is not authenticated
      if (err.response?.status === 401) {
        setSessionInfo(null);
      } else {
        setError('Failed to load session information');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch immediately
    fetchSessionInfo();

    // Refresh every minute to update time remaining
    const interval = setInterval(fetchSessionInfo, 60000);

    // Refresh when tab becomes active
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchSessionInfo();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3">
          <RefreshCw className="animate-spin text-gray-400" size={20} />
          <span className="text-gray-600">Loading session status...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
        <div className="text-red-600 text-sm">{error}</div>
      </div>
    );
  }

  if (!sessionInfo) return null;

  const timeRemaining = formatTimeRemaining(sessionInfo.expiresAt);
  const isExpired = timeRemaining === 'Expired';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 ${isExpired ? 'bg-red-100' : 'bg-green-100'} rounded-lg flex items-center justify-center`}>
          <Shield className={isExpired ? 'text-red-600' : 'text-green-600'} size={20} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-black">Session Status</h3>
          <p className="text-sm text-gray-600">
            Secure server-side session {sessionInfo.rotated && '(rotated)'}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className={`flex items-start gap-3 p-3 ${isExpired ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'} rounded border`}>
          <Clock size={18} className={`${isExpired ? 'text-red-600' : 'text-green-600'} mt-0.5`} />
          <div className="flex-1">
            <div className="text-sm font-medium text-black">Session Token</div>
            <div className="text-xs text-gray-600">
              {isExpired ? 'Session expired' : `Expires in ${timeRemaining}`}
            </div>
            {sessionInfo.lastUsedAt && (
              <div className="text-xs text-gray-500 mt-1">
                Last active: {new Date(sessionInfo.lastUsedAt).toLocaleString()}
              </div>
            )}
            <div className={`text-xs ${isExpired ? 'text-red-600' : 'text-green-600'} mt-1`}>
              {isExpired ? 'Please sign in again' : 'Session managed by secure HttpOnly cookies'}
            </div>
          </div>
        </div>

        {sessionInfo.fingerprintBound && (
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded border border-blue-200">
            <Fingerprint size={18} className="text-blue-600 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium text-black">Browser Fingerprint</div>
              <div className="text-xs text-gray-600">
                Session locked to browser characteristics for security
              </div>
              <div className="text-xs text-blue-600 mt-1">
                Generated per session, not stored in browser
              </div>
            </div>
          </div>
        )}

        {sessionInfo.deviceId && (
          <div className="text-xs text-gray-500 mt-2">
            Device ID: {sessionInfo.deviceId.substring(0, 8)}...
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-600">
          <strong>Enhanced Security Features:</strong>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>No sensitive data stored in browser (localStorage/sessionStorage)</li>
            <li>Session managed via secure HttpOnly cookies</li>
            <li>CSRF protection with double-submit cookies</li>
            <li>Automatic session rotation on auth changes</li>
            <li>Server-side session validation on every request</li>
            <li>Browser fingerprint verification without client storage</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TokenStatus;