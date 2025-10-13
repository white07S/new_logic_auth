import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Key } from 'lucide-react';

const Home = ({ authenticated }) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-black mb-4">
            Secure Authentication System
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Enterprise-grade authentication with Azure Active Directory integration and role-based access control.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
              <Shield className="text-red-600" size={24} />
            </div>
            <h3 className="text-xl font-semibold text-black mb-3">Secure Access</h3>
            <p className="text-gray-600">
              Multi-factor authentication with Azure AD ensures your data remains protected at all times.
            </p>
          </div>

          <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
              <Key className="text-red-600" size={24} />
            </div>
            <h3 className="text-xl font-semibold text-black mb-3">Role-Based Control</h3>
            <p className="text-gray-600">
              Granular permissions system allows precise control over user access and capabilities.
            </p>
          </div>

          <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
              <Lock className="text-red-600" size={24} />
            </div>
            <h3 className="text-xl font-semibold text-black mb-3">Enterprise Ready</h3>
            <p className="text-gray-600">
              Built with industry best practices for authentication, authorization, and security compliance.
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <h2 className="text-3xl font-bold text-black mb-4">
            {authenticated ? 'Welcome Back!' : 'Get Started Today'}
          </h2>
          <p className="text-gray-600 mb-8 max-w-xl mx-auto">
            {authenticated
              ? 'You have access to protected resources. Explore the application features.'
              : 'Sign in with your Azure account to access protected resources and features.'}
          </p>
          {authenticated && (
            <div className="flex justify-center gap-4">
              <button
                onClick={() => navigate('/page1')}
                className="bg-red-600 text-white px-6 py-3 rounded hover:bg-red-700 transition-colors font-medium"
              >
                Go to Page 1
              </button>
              <button
                onClick={() => navigate('/page2')}
                className="border-2 border-red-600 text-red-600 px-6 py-3 rounded hover:bg-red-50 transition-colors font-medium"
              >
                Go to Page 2
              </button>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-16 grid md:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-lg border border-gray-200">
            <h3 className="text-xl font-semibold text-black mb-4">About This System</h3>
            <p className="text-gray-600 mb-4">
              This authentication system demonstrates modern security practices using Azure Active Directory for identity management.
            </p>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">•</span>
                <span>Device code flow for secure authentication</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">•</span>
                <span>JWT-based session management</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">•</span>
                <span>Browser fingerprinting for enhanced security</span>
              </li>
            </ul>
          </div>

          <div className="bg-white p-8 rounded-lg border border-gray-200">
            <h3 className="text-xl font-semibold text-black mb-4">Protected Resources</h3>
            <p className="text-gray-600 mb-4">
              Once authenticated, you'll gain access to protected pages and features based on your role.
            </p>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">•</span>
                <span>Page 1: User-level access required</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">•</span>
                <span>Page 2: User-level access required</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">•</span>
                <span>Additional features based on permissions</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
