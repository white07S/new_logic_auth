import React from 'react';
import { Settings, Database, Users, Shield } from 'lucide-react';

const Page2 = ({ currentUser }) => {
  const user = currentUser;

  if (!user) {
    return null;
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
