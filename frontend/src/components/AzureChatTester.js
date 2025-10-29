import React, { useState } from 'react';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import { azureAPI } from '../utils/api';

const AzureChatTester = () => {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!message.trim()) {
      setError('Please enter a message to send to Azure OpenAI.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setResponse(null);

    try {
      const result = await azureAPI.sendChat(message.trim());
      setResponse(result);
    } catch (err) {
      console.error('Azure chat test failed:', err);
      const detail = err.response?.data?.detail || err.message || 'Azure OpenAI request failed';
      setError(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
          <Sparkles className="text-indigo-600" size={24} />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-black">Azure OpenAI Tester</h2>
          <p className="text-sm text-gray-600">Send a message using your Azure credentials and view the response.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="azure-message" className="block text-sm font-medium text-gray-700 mb-2">
            Prompt
          </label>
          <textarea
            id="azure-message"
            rows="4"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            placeholder="Ask something to verify your Azure OpenAI integration..."
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Requests run against AZURE_OPENAI_DEPLOYMENT with your Azure CLI session.
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition-colors text-sm font-medium disabled:bg-gray-400"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Sending...
              </>
            ) : (
              <>
                <Send size={16} />
                Send Prompt
              </>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-sm text-red-600 rounded">
          {error}
        </div>
      )}

      {response && (
        <div className="mt-6 space-y-3">
          <div>
            <p className="text-xs uppercase font-semibold text-gray-500 mb-1">Response</p>
            <div className="bg-gray-50 border border-gray-200 rounded p-4 text-sm text-gray-800 whitespace-pre-wrap">
              {response.response || 'No response text returned.'}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3 text-xs text-gray-600">
            <div className="bg-gray-50 border border-gray-200 rounded p-3">
              <div className="font-semibold text-gray-700 mb-1">Request ID</div>
              <div className="font-mono text-gray-800 break-all">{response.request_id}</div>
            </div>
            {response.usage && (
              <div className="bg-gray-50 border border-gray-200 rounded p-3">
                <div className="font-semibold text-gray-700 mb-1">Token Usage</div>
                <div>Prompt: {response.usage.prompt_tokens ?? 'n/a'}</div>
                <div>Completion: {response.usage.completion_tokens ?? 'n/a'}</div>
                <div>Total: {response.usage.total_tokens ?? 'n/a'}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AzureChatTester;
