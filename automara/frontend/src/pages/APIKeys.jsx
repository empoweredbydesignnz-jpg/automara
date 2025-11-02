// frontend/src/pages/APIKeys.jsx
// API key management page

import React, { useState, useEffect } from 'react';
import { PlusIcon, KeyIcon, TrashIcon, EyeIcon, EyeOffIcon } from 'lucide-react';
import api from '../utils/api';

const APIKeys = () => {
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    service_name: '',
    key_name: '',
    api_key: '',
    api_secret: '',
  });
  const [visibleKeys, setVisibleKeys] = useState({});
  
  useEffect(() => {
    fetchAPIKeys();
  }, []);
  
  const fetchAPIKeys = async () => {
    try {
      const response = await api.get('/keys');
      setApiKeys(response.data.api_keys);
    } catch (err) {
      console.error('Error fetching API keys:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/keys', formData);
      setShowModal(false);
      setFormData({ service_name: '', key_name: '', api_key: '', api_secret: '' });
      await fetchAPIKeys();
    } catch (err) {
      console.error('Error creating API key:', err);
      alert('Failed to create API key');
    }
  };
  
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to revoke this API key?')) return;
    
    try {
      await api.delete(`/keys/${id}`);
      await fetchAPIKeys();
    } catch (err) {
      console.error('Error deleting API key:', err);
      alert('Failed to revoke API key');
    }
  };
  
  const toggleVisibility = (id) => {
    setVisibleKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">API Keys</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage API keys for external service integrations
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Add API Key
        </button>
      </div>
      
      {/* API Keys List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="divide-y divide-gray-200">
          {apiKeys.length === 0 ? (
            <div className="p-12 text-center">
              <KeyIcon className="w-16 h-16 mx-auto text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No API keys</h3>
              <p className="mt-2 text-sm text-gray-500">
                Add your first API key to connect external services
              </p>
            </div>
          ) : (
            apiKeys.map((key) => (
              <div key={key.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {key.key_name}
                      </h3>
                      <span className={`
                        px-2 py-1 text-xs font-medium rounded
                        ${key.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                        }
                      `}>
                        {key.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      Service: {key.service_name}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      Created: {new Date(key.created_at).toLocaleDateString()}
                      {key.last_used && ` • Last used: ${new Date(key.last_used).toLocaleDateString()}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(key.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Add API Key Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div 
              className="fixed inset-0 bg-gray-500 bg-opacity-75"
              onClick={() => setShowModal(false)}
            />
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Add API Key</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Service Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.service_name}
                    onChange={(e) => setFormData({ ...formData, service_name: e.target.value })}
                    className="block w-full px-4 py-2 mt-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Microsoft Graph"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Key Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.key_name}
                    onChange={(e) => setFormData({ ...formData, key_name: e.target.value })}
                    className="block w-full px-4 py-2 mt-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Production API Key"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    API Key
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.api_key}
                    onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                    className="block w-full px-4 py-2 mt-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    API Secret (Optional)
                  </label>
                  <input
                    type="password"
                    value={formData.api_secret}
                    onChange={(e) => setFormData({ ...formData, api_secret: e.target.value })}
                    className="block w-full px-4 py-2 mt-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    Add Key
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default APIKeys;
