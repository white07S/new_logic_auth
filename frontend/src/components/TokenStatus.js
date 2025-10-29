import React, { useState, useEffect } from 'react';
import { Shield, Fingerprint, RefreshCw, ServerCog, Clock } from 'lucide-react';
import { authAPI } from '../utils/api';

const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'Unknown';
  try {
    return new Date(timestamp).toLocaleString();
  } catch (error) {
    return 'Unknown';
  }
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
        sessionId: data.session_id,
        createdAt: data.created_at,
        lastSeenAt: data.last_seen_at,
        azureConfigDir: data.azure_config_dir,
        azureTenantId: data.azure_tenant_id,
        userIdentifier: data.user_identifier,
        fingerprint: data.fingerprint,
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
  const lastSeenLabel = formatTimestamp(sessionInfo.lastSeenAt);
  const createdLabel = formatTimestamp(sessionInfo.createdAt);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
          <Shield className="text-green-600" size={20} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-black">Session Status</h3>
          <p className="text-sm text-gray-600">Secure server-side session managed by Azure CLI tokens</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded">
          <Clock size={18} className="text-green-600 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-medium text-black">Session Timeline</div>
            <div className="text-xs text-gray-600">Created: {createdLabel}</div>
            <div className="text-xs text-gray-600 mt-1">Last activity: {lastSeenLabel}</div>
            <div className="text-xs text-green-600 mt-2">Session managed via HttpOnly cookies and in-memory validation</div>
          </div>
        </div>

        {sessionInfo.fingerprint && (
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded border border-blue-200">
            <Fingerprint size={18} className="text-blue-600 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium text-black">Browser Fingerprint</div>
              <div className="text-xs text-gray-600">Session locked to your current browser for additional security.</div>
              <div className="text-xs text-blue-600 mt-1">Fingerprint generated per session and never stored client-side.</div>
            </div>
          </div>
        )}

        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded border border-gray-200">
          <ServerCog size={18} className="text-gray-600 mt-0.5" />
          <div className="flex-1 text-xs text-gray-600">
            <div className="text-sm font-medium text-black mb-1">Azure CLI Workspace</div>
            <div>Session ID: <span className="font-mono text-gray-800">{sessionInfo.sessionId?.slice(0, 12)}...</span></div>
            <div>Identifier: {sessionInfo.userIdentifier}</div>
            <div className="truncate">
              Config path: <span className="font-mono text-gray-700">{sessionInfo.azureConfigDir || 'N/A'}</span>
            </div>
            {sessionInfo.azureTenantId && (
              <div>Tenant: {sessionInfo.azureTenantId}</div>
            )}
          </div>
        </div>
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
