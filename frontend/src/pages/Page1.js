import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Calendar, Activity, ArrowRight, Lock, TestTube, CheckCircle, XCircle } from 'lucide-react';
import { isAuthenticated } from '../utils/auth';
import { authAPI } from '../utils/api';
import api from '../utils/api';
import TokenStatus from '../components/TokenStatus';

const Page1 = ({ onShowSnackbar }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [testResults, setTestResults] = useState([]);
  const [testingInProgress, setTestingInProgress] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if authenticated
        const isAuth = await isAuthenticated();
        if (!isAuth) {
          setLoading(false);
          setHasAccess(false);
          return;
        }

        // Fetch current user data from server
        const userData = await authAPI.getCurrentUser();
        setUser(userData);
        setHasAccess(true);
      } catch (error) {
        console.error('Auth check failed:', error);
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [navigate, onShowSnackbar]);

  const testEndpoint = async (name, method, url, body = null) => {
    try {
      const response = method === 'GET'
        ? await api.get(url)
        : await api.post(url, body || { test: 'data' });

      return {
        name,
        method,
        url,
        status: 'success',
        statusCode: response.status,
        data: response.data
      };
    } catch (error) {
      return {
        name,
        method,
        url,
        status: 'error',
        statusCode: error.response?.status || 500,
        error: error.response?.data?.detail || error.message
      };
    }
  };

  const runAllTests = async () => {
    setTestingInProgress(true);
    setTestResults([]);

    const tests = [
      { name: 'Public Endpoint', method: 'GET', url: '/api/test/public' },
      { name: 'User Profile (GET)', method: 'GET', url: '/api/test/user/profile' },
      { name: 'User Data (POST)', method: 'POST', url: '/api/test/user/data', body: { sample: 'test data' } },
      { name: 'Admin Users List (GET)', method: 'GET', url: '/api/test/admin/users' },
      { name: 'Admin Settings (POST)', method: 'POST', url: '/api/test/admin/settings', body: { theme: 'dark' } },
      { name: 'Admin Stats (GET)', method: 'GET', url: '/api/test/admin/stats' },
    ];

    const results = [];
    for (const test of tests) {
      const result = await testEndpoint(test.name, test.method, test.url, test.body);
      results.push(result);
      setTestResults([...results]);
      await new Promise(resolve => setTimeout(resolve, 300)); // Small delay between tests
    }

    setTestingInProgress(false);
  };

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
          <h2 className="text-2xl font-bold text-black mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            You don't have permission to access this page. Please login with appropriate credentials.
          </p>
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
            <h1 className="text-4xl font-bold text-black">Page 1</h1>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm font-medium">
              User Access
            </span>
          </div>
          <p className="text-gray-600">Protected resource - Accessible by all authenticated users</p>
        </div>

        {/* User Info Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-black mb-4">User Information</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">Name</p>
              <p className="text-gray-900 font-medium">{user?.username}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Email</p>
              <p className="text-gray-900 font-medium">{user?.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Roles</p>
              <div className="flex gap-2">
                {user?.roles?.map((role) => (
                  <span
                    key={role}
                    className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm font-medium"
                  >
                    {role}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Status</p>
              <p className="text-gray-900 font-medium">
                {user?.is_active ? (
                  <span className="text-green-600">Active</span>
                ) : (
                  <span className="text-red-600">Inactive</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
              <FileText className="text-red-600" size={24} />
            </div>
            <h3 className="text-lg font-semibold text-black mb-2">Documents</h3>
            <p className="text-gray-600 text-sm mb-4">
              Access your secure documents and files stored in the system.
            </p>
            <button className="text-red-600 hover:text-red-700 font-medium text-sm flex items-center gap-1">
              View Documents
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
              <Calendar className="text-red-600" size={24} />
            </div>
            <h3 className="text-lg font-semibold text-black mb-2">Schedule</h3>
            <p className="text-gray-600 text-sm mb-4">
              View and manage your calendar events and appointments.
            </p>
            <button className="text-red-600 hover:text-red-700 font-medium text-sm flex items-center gap-1">
              Open Calendar
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
              <Activity className="text-red-600" size={24} />
            </div>
            <h3 className="text-lg font-semibold text-black mb-2">Activity</h3>
            <p className="text-gray-600 text-sm mb-4">
              Monitor your recent activities and system interactions.
            </p>
            <button className="text-red-600 hover:text-red-700 font-medium text-sm flex items-center gap-1">
              View Activity
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* RBAC Testing Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <TestTube className="text-red-600" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-black">RBAC Testing</h2>
              <p className="text-gray-600">Test role-based access control endpoints</p>
            </div>
          </div>

          <div className="mb-6">
            <button
              onClick={runAllTests}
              disabled={testingInProgress}
              className="bg-red-600 text-white px-6 py-3 rounded hover:bg-red-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {testingInProgress ? 'Testing...' : 'Run All Tests'}
            </button>
          </div>

          {testResults.length > 0 && (
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 rounded border ${
                    result.status === 'success'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {result.status === 'success' ? (
                        <CheckCircle size={20} className="text-green-600" />
                      ) : (
                        <XCircle size={20} className="text-red-600" />
                      )}
                      <div>
                        <span className="font-medium text-black">{result.name}</span>
                        <span className="text-sm text-gray-600 ml-2">
                          {result.method} {result.url}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        result.status === 'success'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {result.statusCode}
                    </span>
                  </div>

                  {result.status === 'success' ? (
                    <div className="mt-2 text-sm">
                      <div className="text-gray-700 mb-1">
                        <strong>Access Level:</strong> {result.data.access_level}
                      </div>
                      <div className="text-gray-700 mb-1">
                        <strong>Allowed Roles:</strong>{' '}
                        {result.data.allowed_roles?.join(', ') || 'Any'}
                      </div>
                      <div className="text-green-600">
                        ✓ {result.data.message}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <div className="text-red-600 text-sm">
                        ✗ {result.error}
                      </div>
                      {result.statusCode === 403 && (
                        <div className="text-xs text-gray-600 mt-1">
                          You don't have the required role to access this endpoint
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {testResults.length === 0 && !testingInProgress && (
            <div className="text-center py-8 text-gray-500">
              Click "Run All Tests" to test RBAC endpoints
            </div>
          )}
        </div>

        {/* Token Status Section */}
        <TokenStatus />

        {/* Info Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mt-8">
          <h2 className="text-2xl font-semibold text-black mb-4">About This Page</h2>
          <p className="text-gray-600 mb-4">
            This is a protected page that requires authentication. You successfully accessed this resource
            because your account has the necessary permissions.
          </p>
          <div className="border-t border-gray-200 pt-4 mt-4">
            <h3 className="text-lg font-semibold text-black mb-3">Enhanced Security Features</h3>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">•</span>
                <span>No sensitive data stored in browser (localStorage removed)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">•</span>
                <span>Session managed via secure HttpOnly cookies</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">•</span>
                <span>CSRF protection with double-submit cookies</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">•</span>
                <span>Server-side session validation on every request</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Page1;