// frontend/src/components/WorkflowModal.jsx
// Modal for creating new workflows from templates

import React, { useState } from 'react';
import { XIcon, CheckIcon } from 'lucide-react';

const WorkflowModal = ({ templates, onClose, onCreate }) => {
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [credentials, setCredentials] = useState({
    tenant_id: '',
    client_id: '',
    client_secret: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await onCreate(selectedTemplate, credentials);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create workflow');
      setLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />
        
        {/* Modal */}
        <div className="relative inline-block w-full max-w-2xl px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900">
              {step === 1 ? 'Choose a Template' : 'Configure Workflow'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XIcon className="w-6 h-6" />
            </button>
          </div>
          
          {/* Steps Indicator */}
          <div className="flex items-center justify-center mb-8 space-x-4">
            <div className={`
              flex items-center justify-center w-8 h-8 rounded-full
              ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}
            `}>
              {step > 1 ? <CheckIcon className="w-5 h-5" /> : '1'}
            </div>
            <div className={`h-1 w-16 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
            <div className={`
              flex items-center justify-center w-8 h-8 rounded-full
              ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}
            `}>
              2
            </div>
          </div>
          
          {/* Content */}
          {step === 1 ? (
            <div className="space-y-4">
              {Object.entries(templates).map(([key, template]) => (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedTemplate(key);
                    setStep(2);
                  }}
                  className="w-full p-6 text-left transition-all border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50"
                >
                  <h4 className="text-lg font-semibold text-gray-900">
                    {template.name}
                  </h4>
                  <p className="mt-2 text-sm text-gray-600">
                    {template.description}
                  </p>
                  <div className="flex items-center mt-3 space-x-2">
                    <span className="px-2 py-1 text-xs font-medium text-blue-800 bg-blue-100 rounded">
                      {template.category}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 text-sm text-red-800 bg-red-100 rounded-lg">
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Azure Tenant ID
                </label>
                <input
                  type="text"
                  required
                  value={credentials.tenant_id}
                  onChange={(e) => setCredentials({ ...credentials, tenant_id: e.target.value })}
                  className="block w-full px-4 py-2 mt-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="00000000-0000-0000-0000-000000000000"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Client ID (Application ID)
                </label>
                <input
                  type="text"
                  required
                  value={credentials.client_id}
                  onChange={(e) => setCredentials({ ...credentials, client_id: e.target.value })}
                  className="block w-full px-4 py-2 mt-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="00000000-0000-0000-0000-000000000000"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Client Secret
                </label>
                <input
                  type="password"
                  required
                  value={credentials.client_secret}
                  onChange={(e) => setCredentials({ ...credentials, client_secret: e.target.value })}
                  className="block w-full px-4 py-2 mt-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Your client secret"
                />
              </div>
              
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Your credentials will be encrypted before storage using AES-256 encryption.
                </p>
              </div>
              
              <div className="flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating...' : 'Create Workflow'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowModal;
