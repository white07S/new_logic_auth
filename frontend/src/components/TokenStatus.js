import React, { useState, useEffect } from 'react';
import { Shield, Clock, Fingerprint } from 'lucide-react';

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
  const [tokenInfo, setTokenInfo] = useState(null);

  useEffect(() => {
    const checkTokenStatus = () => {
      const userRaw = localStorage.getItem('user');
      if (userRaw) {
        try {
          const user = JSON.parse(userRaw);
          setTokenInfo({
            graphTokenExpiry: user.token_expires_at,
            fingerprintBound: true,
          });
        } catch (err) {
          console.warn('Unable to parse stored user session', err);
          setTokenInfo(null);
        }
      } else {
        setTokenInfo(null);
      }
    };

    checkTokenStatus();
    const interval = setInterval(checkTokenStatus, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  if (!tokenInfo) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
          <Shield className="text-green-600" size={20} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-black">Session Status</h3>
          <p className="text-sm text-gray-600">Your authentication tokens</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-3 p-3 bg-green-50 rounded border border-green-200">
          <Clock size={18} className="text-green-600 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-medium text-black">Graph Access Token</div>
            <div className="text-xs text-gray-600">
              Expires in {formatTimeRemaining(tokenInfo.graphTokenExpiry)}
            </div>
            <div className="text-xs text-green-600 mt-1">
              Renew by signing in again after expiry
            </div>
          </div>
        </div>

        {tokenInfo.fingerprintBound && (
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded border border-blue-200">
            <Fingerprint size={18} className="text-blue-600 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium text-black">Fingerprint Bound</div>
              <div className="text-xs text-gray-600">
                Session locked to this browser fingerprint for consistency
              </div>
              <div className="text-xs text-blue-600 mt-1">
                Switching browsers or clearing storage will require a new login
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-600">
          <strong>How it works:</strong>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Azure device login generates a Microsoft Graph access token</li>
            <li>Token is cached securely on the server and referenced via cookie</li>
            <li>Token expires after 24 hours—sign in again to renew</li>
            <li>Browser fingerprint must match for every authenticated request</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TokenStatus;
