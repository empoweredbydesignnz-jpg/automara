// frontend/src/pages/Workflows.jsx
// Workflow management page with template selection

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  PlusIcon, 
  PlayIcon, 
  PauseIcon, 
  TrashIcon,
  SettingsIcon,
  ExternalLinkIcon
} from 'lucide-react';
import api from '../utils/api';
import WorkflowModal from '../components/WorkflowModal';

const Workflows = () => {
  const [workflows, setWorkflows] = useState([]);
  const [templates, setTemplates] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  useEffect(() => {
    fetchWorkflows();
    fetchTemplates();
  }, []);
  
  const fetchWorkflows = async () => {
    try {
      const response = await api.get('/workflows');
      setWorkflows(response.data.workflows);
    } catch (err) {
      console.error('Error fetching workflows:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchTemplates = async () => {
    try {
      const response = await api.get('/workflows/templates');
      setTemplates(response.data.templates);
    } catch (err) {
      console.error('Error fetching templates:', err);
    }
  };
  
  const handleToggleActive = async (workflowId, currentState) => {
    try {
      const endpoint = currentState ? 'deactivate' : 'activate';
      await api.post(`/workflows/${workflowId}/${endpoint}`);
      await fetchWorkflows();
    } catch (err) {
      console.error(`Error ${currentState ? 'deactivating' : 'activating'} workflow:`, err);
      alert(`Failed to ${currentState ? 'deactivate' : 'activate'} workflow`);
    }
  };
  
  const handleDelete = async (workflowId) => {
    if (!window.confirm('Are you sure you want to delete this workflow?')) return;
    
    try {
      await api.delete(`/workflows/${workflowId}`);
      await fetchWorkflows();
    } catch (err) {
      console.error('Error deleting workflow:', err);
      alert('Failed to delete workflow');
    }
  };
  
  const handleCreateWorkflow = async (templateType, credentials) => {
    try {
      await api.post('/workflows', {
        template_type: templateType,
        credentials,
      });
      setShowModal(false);
      await fetchWorkflows();
    } catch (err) {
      console.error('Error creating workflow:', err);
      throw err;
    }
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
          <h1 className="text-3xl font-bold text-gray-900">Workflows</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage and monitor your automation workflows
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Create Workflow
        </button>
      </div>
      
      {/* Workflows Grid */}
      {workflows.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <SettingsIcon className="w-16 h-16 mx-auto text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No workflows yet</h3>
          <p className="mt-2 text-sm text-gray-500">
            Get started by creating your first automation workflow
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center px-4 py-2 mt-6 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Create Workflow
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {workflows.map((workflow) => (
            <div
              key={workflow.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <div className={`
                        w-2 h-2 rounded-full
                        ${workflow.is_active ? 'bg-green-500' : 'bg-gray-400'}
                      `} />
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {workflow.name}
                      </h3>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {workflow.workflow_type.replace(/_/g, ' ').toUpperCase()}
                    </p>
                  </div>
                </div>
                
                {/* Description */}
                <p className="mt-4 text-sm text-gray-600 line-clamp-2">
                  {workflow.description || 'No description provided'}
                </p>
                
                {/* Stats */}
                <div className="mt-4 flex items-center justify-between text-sm">
                  <div>
                    <span className="text-gray-500">Executions:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      {workflow.execution_count}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Last run:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      {workflow.last_executed 
                        ? new Date(workflow.last_executed).toLocaleDateString()
                        : 'Never'
                      }
                    </span>
                  </div>
                </div>
                
                {/* Webhook URL */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Webhook URL</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(workflow.webhook_url);
                        alert('Webhook URL copied to clipboard!');
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-700 truncate font-mono">
                    {workflow.webhook_url}
                  </p>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleToggleActive(workflow.id, workflow.is_active)}
                    className={`
                      inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                      ${workflow.is_active
                        ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                        : 'bg-green-100 text-green-800 hover:bg-green-200'
                      }
                    `}
                  >
                    {workflow.is_active ? (
                      <>
                        <PauseIcon className="w-4 h-4 mr-1" />
                        Pause
                      </>
                    ) : (
                      <>
                        <PlayIcon className="w-4 h-4 mr-1" />
                        Activate
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={() => handleDelete(workflow.id)}
                    className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium text-red-800 bg-red-100 hover:bg-red-200 transition-colors"
                  >
                    <TrashIcon className="w-4 h-4 mr-1" />
                    Delete
                  </button>
                </div>
                
                <Link
                  to={`/workflows/${workflow.id}`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Details
                  <ExternalLinkIcon className="inline w-4 h-4 ml-1" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Create Workflow Modal */}
      {showModal && (
        <WorkflowModal
          templates={templates}
          onClose={() => setShowModal(false)}
          onCreate={handleCreateWorkflow}
        />
      )}
    </div>
  );
};

export default Workflows;
