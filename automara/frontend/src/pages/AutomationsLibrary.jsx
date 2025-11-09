// frontend/src/pages/AutomationsLibrary.jsx
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      
      // Fetch workflow templates
      const templatesResponse = await axios.get('/api/workflows/templates', {
        headers: {
          'x-user-role': user?.role || 'client_user',
          'x-tenant-id': user?.tenantId || ''
        }
      });
      
      // Fetch active workflows
      const workflowsResponse = await axios.get('/api/workflows', {
        headers: {
          'x-user-role': user?.role || 'client_user',
          'x-tenant-id': user?.tenantId || ''
        }
      });

      setTemplates(templatesResponse.data.templates || []);
      setWorkflows(workflowsResponse.data.workflows || []);
    } catch (error) {
      console.error('Error fetching automations data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkflow = async (templateType, config) => {
    setCreating(true);
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      const response = await axios.post('/api/workflows/create', {
        template_type: templateType,
        configuration: config
      }, {
        headers: {
          'x-user-role': user?.role || 'client_user',
          'x-tenant-id': user?.tenantId || ''
        }
      });

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
      const user = JSON.parse(localStorage.getItem('user'));
      await axios.patch(`/api/workflows/${workflowId}/toggle`, 
        { active: !isActive },
        {
          headers: {
            'x-user-role': user?.role || 'client_user',
            'x-tenant-id': user?.tenantId || ''
          }
        }
      );
      
      fetchData();
    } catch (error) {
      console.error('Error toggling workflow:', error);
      alert('Failed to update workflow');
    }
  };

  const handleExecuteWorkflow = async (workflowId) => {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      await axios.post(`/api/workflows/${workflowId}/execute`, {}, {
        headers: {
          'x-user-role': user?.role || 'client_user',
          'x-tenant-id': user?.tenantId || ''
        }
      });
      
      alert('Workflow execution started!');
    } catch (error) {
      console.error('Error executing workflow:', error);
      alert('Failed to execute workflow');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return '✅';
      case 'inactive':
        return '⏸️';
      case 'error':
        return '❌';
      default:
        return '⏳';
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'm365':
        return '🌐';
      case 'security':
        return '🔒';
      case 'productivity':
        return '⚡';
      case 'integrations':
        return '🔗';
      default:
        return '⚙️';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center space-x-3">
              <span className="text-2xl">⚡</span>
              <span>Automations Library</span>
            </h1>
            <p className="text-gray-400">
              Manage your N8N workflow automations and templates
            </p>
          </div>
          <button
            onClick={() => setActiveTab('templates')}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-purple-700 hover:to-pink-700 transition flex items-center space-x-2"
          >
            <span className="text-lg">+</span>
            <span>Browse Templates</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-8">
        <div className="border-b border-gray-700">
          <nav className="flex space-x-8">
            {[
              { id: 'workflows', name: 'Active Workflows', count: workflows.filter(w => w.is_active).length },
              { id: 'templates', name: 'Templates', count: templates.length },
              { id: 'executions', name: 'Recent Executions', count: 0 }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab.name}
                {tab.count > 0 && (
                  <span className="ml-2 bg-gray-700 text-gray-300 rounded-full px-2 py-1 text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Active Workflows Tab */}
      {activeTab === 'workflows' && (
        <div className="space-y-6">
          {workflows.length === 0 ? (
            <div className="text-center py-12 bg-gray-800 rounded-xl border border-gray-700">
              <div className="text-6xl mb-4">⚡</div>
              <h3 className="text-xl font-semibold text-white mb-2">No workflows yet</h3>
              <p className="text-gray-400 mb-6">Get started by creating your first automation</p>
              <button
                onClick={() => setActiveTab('templates')}
                className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-6 rounded-lg transition"
              >
                Browse Templates
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
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white text-xl">
                        ⚡
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{workflow.name}</h3>
                        <p className="text-sm text-gray-400">{workflow.workflow_type}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{getStatusIcon(workflow.is_active ? 'active' : 'inactive')}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        workflow.is_active 
                          ? 'bg-green-500 bg-opacity-10 text-green-400' 
                          : 'bg-gray-500 bg-opacity-10 text-gray-400'
                      }`}>
                        {workflow.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-gray-300 mb-4 line-clamp-2">
                    {workflow.description || 'No description available'}
                  </p>

                  <div className="space-y-2 mb-4 text-sm text-gray-400">
                    <div className="flex items-center justify-between">
                      <span>Webhook URL:</span>
                      <code className="text-xs bg-gray-900 px-2 py-1 rounded text-purple-400">
                        {workflow.webhook_url?.split('/').pop() || 'N/A'}
                      </code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Last execution:</span>
                      <span>{workflow.last_execution ? new Date(workflow.last_execution).toLocaleDateString() : 'Never'}</span>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleToggleWorkflow(workflow.n8n_workflow_id, workflow.is_active)}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${
                        workflow.is_active
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      {workflow.is_active ? '⏸ Stop' : '▶ Start'}
                    </button>
                    <button
                      onClick={() => handleExecuteWorkflow(workflow.n8n_workflow_id)}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded-lg text-sm font-medium transition"
                    >
                      🚀 Run Now
                    </button>
                    <button className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-lg transition">
                      <span className="text-lg">⚙️</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div
                key={template.type}
                className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-purple-500 transition group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white text-xl">
                      {getCategoryIcon(template.category)}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{template.name}</h3>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-400">🏷️ {template.category}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-gray-300 mb-4 line-clamp-3">
                  {template.description}
                </p>

                <div className="space-y-2 mb-4">
                  {template.config_fields?.slice(0, 3).map((field) => (
                    <div key={field.name} className="flex items-center space-x-2 text-xs">
                      <span className="text-gray-400">• {field.label}</span>
                      {field.required && <span className="text-red-400">*</span>}
                    </div>
                  ))}
                  {template.config_fields?.length > 3 && (
                    <div className="text-xs text-gray-400">
                      +{template.config_fields.length - 3} more fields
                    </div>
                  )}
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setSelectedTemplate(template);
                      setShowCreateModal(true);
                    }}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition"
                  >
                    🚀 Use Template
                  </button>
                  <button className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-lg transition">
                    <span className="text-lg">📋</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Executions Tab */}
      {activeTab === 'executions' && (
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-xl font-bold text-white">📊 Recent Workflow Executions</h2>
          </div>
          <div className="p-6">
            <div className="text-center py-12 text-gray-400">
              <div className="text-6xl mb-4">⏳</div>
              <p>Execution history will appear here</p>
              <p className="text-sm">Run a workflow to see execution details</p>
            </div>
          </div>
        </div>
      )}

      {/* Create Workflow Modal */}
      {showCreateModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-8 max-w-2xl w-full border border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Create Workflow</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <span className="text-2xl">✖</span>
              </button>
            </div>

            <div className="mb-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white text-xl">
                  {getCategoryIcon(selectedTemplate.category)}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">{selectedTemplate.name}</h3>
                  <p className="text-gray-400">{selectedTemplate.description}</p>
                </div>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const config = Object.fromEntries(formData);
                handleCreateWorkflow(selectedTemplate.type, config);
              }}
              className="space-y-4"
            >
              {selectedTemplate.config_fields?.map((field) => (
                <div key={field.name}>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  <input
                    type={field.type === 'password' ? 'password' : 'text'}
                    name={field.name}
                    required={field.required}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                  />
                </div>
              ))}

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-lg transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3 px-4 rounded-lg transition font-medium disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {creating ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Workflow</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomationsLibrary;