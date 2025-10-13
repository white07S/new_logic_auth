import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Database, Users, Shield, Lock } from 'lucide-react';
import { isAuthenticated, getCurrentUser } from '../utils/auth';
import { authAPI } from '../utils/api';

const Page2 = ({ onShowSnackbar }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(getCurrentUser());
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [isAdminOnly, setIsAdminOnly] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      if (!isAuthenticated()) {
        setLoading(false);
        setHasAccess(false);
        return;
      }

      try {
        const userData = await authAPI.getCurrentUser();
        setUser(userData);
        console.log('Page2 - User data:', userData);
        console.log('Page2 - Checking roles:', userData.roles);
        console.log('Page2 - Has admin?', userData.roles.includes('admin'));

        // Page2 requires admin role - demonstrate role-based access
        if (userData.roles && userData.roles.includes('admin')) {
          console.log('Page2 - Access granted');
          setHasAccess(true);
          setIsAdminOnly(true);
        } else {
          console.log('Page2 - Access denied');
          setHasAccess(false);
          setIsAdminOnly(true);
        }
      } catch (error) {
        console.error('Page2 - Error:', error);
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [navigate, onShowSnackbar]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="text-red-600" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-black mb-2">
            {isAdminOnly ? 'Admin Access Required' : 'Access Denied'}
          </h2>
          <p className="text-gray-600 mb-2">
            {isAdminOnly
              ? 'This page requires administrator privileges.'
              : 'You don\'t have permission to access this page.'}
          </p>
          {user && (
            <div className="bg-gray-50 rounded p-4 mb-6 text-left">
              <p className="text-sm text-gray-600 mb-1">Current User:</p>
              <p className="text-sm font-medium text-black">{user.email}</p>
              <p className="text-sm text-gray-600 mt-2 mb-1">Your Roles:</p>
              <div className="flex gap-2">
                {user.roles.map(role => (
                  <span key={role} className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">
                    {role}
                  </span>
                ))}
              </div>
              <p className="text-sm text-red-600 mt-3">Required: admin</p>
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
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-bold text-black">Page 2</h1>
            <span className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm font-medium">
              Admin Only
            </span>
          </div>
          <p className="text-gray-600">Protected resource - Requires administrator privileges</p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Total Users</h3>
              <Users className="text-red-600" size={20} />
            </div>
            <p className="text-3xl font-bold text-black">1,248</p>
            <p className="text-sm text-green-600 mt-2">+12% from last month</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Active Sessions</h3>
              <Activity className="text-red-600" size={20} />
            </div>
            <p className="text-3xl font-bold text-black">342</p>
            <p className="text-sm text-green-600 mt-2">+8% from last hour</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Security Events</h3>
              <Shield className="text-red-600" size={20} />
            </div>
            <p className="text-3xl font-bold text-black">23</p>
            <p className="text-sm text-red-600 mt-2">Requires attention</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Database Size</h3>
              <Database className="text-red-600" size={20} />
            </div>
            <p className="text-3xl font-bold text-black">2.4GB</p>
            <p className="text-sm text-gray-600 mt-2">78% capacity</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-black mb-4">System Overview</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                <span className="text-gray-600">Application Status</span>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm font-medium">
                  Operational
                </span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                <span className="text-gray-600">API Response Time</span>
                <span className="text-black font-medium">42ms</span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                <span className="text-gray-600">Uptime</span>
                <span className="text-black font-medium">99.97%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Last Backup</span>
                <span className="text-black font-medium">2 hours ago</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-black mb-4">Recent Activity</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-red-600 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-gray-900 font-medium">User login successful</p>
                  <p className="text-sm text-gray-500">{user?.email} - 2 minutes ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-gray-400 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-gray-900 font-medium">Database backup completed</p>
                  <p className="text-sm text-gray-500">System - 2 hours ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-gray-400 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-gray-900 font-medium">Security scan completed</p>
                  <p className="text-sm text-gray-500">System - 4 hours ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-gray-400 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-gray-900 font-medium">New user registered</p>
                  <p className="text-sm text-gray-500">Admin - 6 hours ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Settings Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <Settings className="text-red-600" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-black">Configuration</h2>
              <p className="text-gray-600">Manage system settings and preferences</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-black">Security Settings</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded">
                  <span className="text-gray-700">Two-Factor Authentication</span>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm font-medium">
                    Enabled
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded">
                  <span className="text-gray-700">Session Timeout</span>
                  <span className="text-gray-900 font-medium">30 minutes</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded">
                  <span className="text-gray-700">Password Policy</span>
                  <span className="text-gray-900 font-medium">Strong</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-black">Account Details</h3>
              <div className="space-y-3">
                <div className="p-4 bg-gray-50 rounded">
                  <p className="text-sm text-gray-500 mb-1">Account Created</p>
                  <p className="text-gray-900 font-medium">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded">
                  <p className="text-sm text-gray-500 mb-1">Last Login</p>
                  <p className="text-gray-900 font-medium">
                    {user?.last_login ? new Date(user.last_login).toLocaleString() : 'Just now'}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded">
                  <p className="text-sm text-gray-500 mb-1">Account Type</p>
                  <p className="text-gray-900 font-medium capitalize">{user?.roles?.[0] || 'User'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Activity = ({ size, className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
  </svg>
);

export default Page2;
