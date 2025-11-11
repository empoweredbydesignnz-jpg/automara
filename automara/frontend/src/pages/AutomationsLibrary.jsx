import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AutomationsLibrary = () => {
  const [workflows, setWorkflows] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('workflows');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user'));
    setUser(storedUser);
    fetchData();
  }, []);

  const getAuthHeaders = () => {
    const user = JSON.parse(localStorage.getItem('user'));
    return {
      'x-user-role': user?.role || 'client_user',
      'x-tenant-id': user?.tenantId || '',
    };
  };

  const fetchData = async () => {
    try {
      const headers = getAuthHeaders();

      const [templatesResponse, workflowsResponse] = await Promise.all([
        axios.get('/api/workflows/templates', { headers }),
        axios.get('/api/workflows', { headers }),
      ]);

      setTemplates(templatesResponse.data.templates || []);
      setWorkflows(workflowsResponse.data.workflows || []);
    } catch (error) {
      console.error('Error fetching automations data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncN8N = async () => {
    setSyncing(true);
    try {
      const headers = getAuthHeaders();

      const response = await axios.post('/api/workflows/sync', {}, { headers });

      if (response.data.success) {
        alert(`Successfully synced ${response.data.workflows.length} workflows from N8N!`);
        fetchData();
      } else {
        alert('Sync completed, but no workflows were imported.');
      }
    } catch (error) {
      console.error('Error syncing N8N workflows:', error);
      alert('Failed to sync workflows: ' + (error.response?.data?.error || error.message));
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateWorkflow = async (templateType, config) => {
    setCreating(true);
    try {
      const headers = getAuthHeaders();

      const response = await axios.post(
        '/api/workflows/create',
        {
          template_type: templateType,
          configuration: config,
        },
        { headers }
      );

      if (response.data.success) {
        alert('Workflow created successfully!');
        setShowCreateModal(false);
        setSelectedTemplate(null);
        fetchData();
      }
    } catch (error) {
      console.error('Error creating workflow:', error);
      alert(error.response?.data?.error || 'Failed to create workflow');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleWorkflow = async (workflowId, isActive) => {
    try {
      const headers = getAuthHeaders();

      await axios.patch(
        `/api/workflows/${workflowId}/toggle`,
        { active: !isActive },
        { headers }
      );

      fetchData();
    } catch (error) {
      console.error('Error toggling workflow:', error);
      alert('Failed to toggle workflow status');
    }
  };

  const handleDeleteWorkflow = async (workflowId) => {
    if (!confirm('Are you sure you want to delete this workflow? This action cannot be undone.')) {
      return;
    }

    try {
      const headers = getAuthHeaders();
      
      await axios.delete(`/api/workflows/${workflowId}`, { headers });
      
      alert('Workflow deleted successfully!');
      fetchData();
    } catch (error) {
      console.error('Error deleting workflow:', error);
      alert('Failed to delete workflow: ' + (error.response?.data?.error || error.message));
    }
  };

  const isAdmin = () => {
    return user?.role === 'global_admin' || user?.role === 'client_admin' || user?.role === 'msp_admin';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Automations Library</h1>
          <p className="text-gray-400">Manage your n8n workflows and templates</p>
        </div>
        <button
          onClick={handleSyncN8N}
          disabled={syncing}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition disabled:opacity-50 flex items-center space-x-2"
        >
          {syncing ? (
            <>
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Syncing...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Sync n8n</span>
            </>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 mb-8 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('workflows')}
          className={`pb-4 px-2 font-semibold transition ${
            activeTab === 'workflows'
              ? 'border-b-2 border-purple-500 text-purple-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          My Workflows ({workflows.length})
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`pb-4 px-2 font-semibold transition ${
            activeTab === 'templates'
              ? 'border-b-2 border-purple-500 text-purple-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Templates ({templates.length})
        </button>
      </div>

      {/* Workflows Tab */}
      {activeTab === 'workflows' && (
        <div>
          {workflows.length === 0 ? (
            <div className="text-center py-16 bg-gray-800 rounded-xl border border-gray-700">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h3 className="text-xl font-semibold mb-2">No workflows yet</h3>
              <p className="text-gray-400 mb-6">Sync your n8n workflows to get started</p>
              <button
                onClick={handleSyncN8N}
                className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-6 rounded-lg transition"
              >
                Sync n8n Workflows
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-purple-500 transition"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-2">{workflow.name}</h3>
                      <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          workflow.active
                            ? 'bg-green-500 bg-opacity-10 text-green-400 border border-green-500'
                            : 'bg-gray-500 bg-opacity-10 text-gray-400 border border-gray-500'
                        }`}>
                          {workflow.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-sm text-gray-400 mb-4">
                    <p>Created: {new Date(workflow.created_at).toLocaleDateString()}</p>
                    {workflow.updated_at && (
                      <p>Updated: {new Date(workflow.updated_at).toLocaleDateString()}</p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleToggleWorkflow(workflow.id, workflow.active)}
                      className={`flex-1 px-4 py-2 rounded-lg transition font-medium ${
                        workflow.active
                          ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      {workflow.active ? 'Deactivate' : 'Activate'}
                    </button>

                    {isAdmin() && (
                      <button
                        onClick={() => handleDeleteWorkflow(workflow.id)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-medium"
                        title="Delete workflow"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div>
          {templates.length === 0 ? (
            <div className="text-center py-16 bg-gray-800 rounded-xl border border-gray-700">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-xl font-semibold mb-2">No templates available</h3>
              <p className="text-gray-400">Check back later for workflow templates</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-purple-500 transition cursor-pointer"
                  onClick={() => {
                    setSelectedTemplate(template);
                    setShowCreateModal(true);
                  }}
                >
                  <div className="mb-4">
                    <span className="px-3 py-1 bg-purple-500 bg-opacity-10 text-purple-400 text-xs font-semibold rounded-full border border-purple-500">
                      {template.category}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold mb-2">{template.name}</h3>
                  <p className="text-gray-400 text-sm mb-4">{template.description}</p>
                  <button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition font-medium">
                    Use Template
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create from Template Modal */}
      {showCreateModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full border border-gray-700">
            <h2 className="text-2xl font-bold mb-4">Create from Template</h2>
            <p className="text-gray-400 mb-6">
              Creating workflow from: <strong>{selectedTemplate.name}</strong>
            </p>
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setSelectedTemplate(null);
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-lg transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleCreateWorkflow(selectedTemplate.id, {})}
                disabled={creating}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg transition font-medium disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomationsLibrary;