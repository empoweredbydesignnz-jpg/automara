import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AutomationsLibrary = () => {
  const [workflows, setWorkflows] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('library');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [user, setUser] = useState(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activating, setActivating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  const getFirstNodeNotes = (workflow) => {
    try {
      if (workflow.n8n_data?.nodes && workflow.n8n_data.nodes.length > 0) {
        return workflow.n8n_data.nodes[0].notes || 'No description available';
      }
      if (workflow.workflowData) {
        const workflowData = JSON.parse(workflow.workflowData);
        if (workflowData.nodes && workflowData.nodes.length > 0) {
          return workflowData.nodes[0].notes || 'No description available';
        }
      }
    } catch (error) {
      console.error('Error parsing workflow:', error);
    }
    return 'No description available';
  };

  const handleViewDetails = async (workflow) => {
    setSelectedWorkflow(workflow);
    setShowDetailModal(true);
    setLoadingDetails(true);
    
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`/api/workflows/${workflow.id}/details`, { headers });
      
      setSelectedWorkflow({
        ...workflow,
        fullData: response.data.workflow
      });
    } catch (error) {
      console.error('Error fetching workflow details:', error);
    } finally {
      setLoadingDetails(false);
    }
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

  const handleToggleWorkflow = async (workflowId, isActive) => {
  try {
    const headers = getAuthHeaders();

    if (isActive) {
      // Deactivate workflow
      const response = await axios.post(
        `/api/workflows/${workflowId}/deactivate`,
        {},
        { headers }
      );

      if (response.data.success) {
        alert('Workflow deactivated successfully!');
        fetchData();
      }
    } else {
      // Activate workflow - clones to company folder
      setActivating(true);
      
      const response = await axios.post(
        `/api/workflows/${workflowId}/activate`,
        {},
        { headers }
      );

      if (response.data.success) {
        alert(
          `✅ Workflow Activated Successfully!\n\n` +
          `Name: ${response.data.workflow.name}\n` +
          `Folder: ${response.data.workflow.folder}\n\n` +
          `The workflow has been cloned to your company folder in n8n.`
        );
        fetchData();
      }
    }
  } catch (error) {
    console.error('Error toggling workflow:', error);
    const errorMessage = error.response?.data?.message || error.message;
    alert(`❌ Failed to ${isActive ? 'deactivate' : 'activate'} workflow:\n${errorMessage}`);
  } finally {
    if (!isActive) {
      setActivating(false);
    }
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

  const filteredWorkflows = workflows.filter(workflow =>
    workflow.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeWorkflows = filteredWorkflows.filter(w => w.active);
  const displayWorkflows = activeTab === 'workflows' ? activeWorkflows : filteredWorkflows;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-purple-500 rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-400 text-lg font-medium">Loading workflows...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-4 md:p-8">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent mb-2">
              Automation Library
            </h1>
            <p className="text-slate-400 text-lg">Manage and deploy your automation workflows</p>
          </div>
          
          <button
            onClick={handleSyncN8N}
            disabled={syncing}
            className="group relative px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-semibold shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {syncing ? (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Syncing...</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Sync Library</span>
              </div>
            )}
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search workflows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-slate-900/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1.5 bg-slate-900/50 rounded-xl border border-slate-800 backdrop-blur-sm">
          <button
            onClick={() => setActiveTab('workflows')}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'workflows'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <span>My Workflows</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'workflows' ? 'bg-white/20' : 'bg-slate-800'
              }`}>
                {activeWorkflows.length}
              </span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'library'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <span>Library</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'library' ? 'bg-white/20' : 'bg-slate-800'
              }`}>
                {workflows.length}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto">
        {displayWorkflows.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/30 backdrop-blur-sm rounded-2xl border border-slate-800">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-2xl flex items-center justify-center">
              <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-3">
              {searchQuery ? 'No workflows found' : activeTab === 'workflows' ? 'No active workflows' : 'No workflows yet'}
            </h3>
            <p className="text-slate-400 mb-8 max-w-md mx-auto">
              {searchQuery ? 'Try adjusting your search terms' : activeTab === 'workflows' ? 'Activate workflows from your library to see them here' : 'Sync your n8n workflows to get started'}
            </p>
            {!searchQuery && activeTab === 'library' && (
              <button 
                onClick={handleSyncN8N} 
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-semibold shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all hover:scale-105"
              >
                Sync n8n Workflows
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayWorkflows.map((workflow) => (
              <div 
                key={workflow.id} 
                className="group relative bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-2xl border border-slate-800 hover:border-purple-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-1 overflow-hidden"
              >
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/0 via-purple-600/0 to-pink-600/0 group-hover:from-purple-600/5 group-hover:to-pink-600/5 transition-all duration-300"></div>
                
                <div className="relative p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 pr-4">
                      <h3 className="text-xl font-bold mb-2 text-white group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-purple-400 group-hover:to-pink-400 group-hover:bg-clip-text transition-all">
                        {workflow.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        <div className={`relative inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${
                          workflow.active 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-slate-700/50 text-slate-400 border border-slate-700'
                        }`}>
                          <div className={`w-2 h-2 rounded-full ${workflow.active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></div>
                          {workflow.active ? 'Active' : 'Inactive'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Description Preview */}
                  <div className="mb-4">
                    <p className="text-sm text-slate-400 line-clamp-2">
                      {getFirstNodeNotes(workflow).substring(0, 100)}
                      {getFirstNodeNotes(workflow).length > 100 ? '...' : ''}
                    </p>
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-xs text-slate-500 mb-4 pb-4 border-b border-slate-800">
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {new Date(workflow.updated_at).toLocaleDateString()}
                    </div>
                    {workflow.n8n_data?.nodes && (
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                        </svg>
                        {workflow.n8n_data.nodes.length} nodes
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <button
  onClick={() => handleToggleWorkflow(workflow.id, workflow.active)}
  disabled={activating}
  className={`flex-1 px-4 py-2.5 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 font-medium ${
    workflow.active 
      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20' 
      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
  } ${activating ? 'opacity-50 cursor-not-allowed' : ''}`}
>
  {activating ? (
    <>
      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
      <span>Activating...</span>
    </>
  ) : workflow.active ? (
    <>
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Pause
    </>
  ) : (
    <>
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Activate
    </>
  )}
</button>

                    <button 
                      onClick={() => handleViewDetails(workflow)} 
                      className="px-4 py-2.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg font-medium transition-all hover:bg-blue-500/20 flex items-center justify-center"
                      title="View details"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>

                    {isAdmin() && (
                      <button 
                        onClick={() => handleDeleteWorkflow(workflow.id)} 
                        className="px-4 py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg font-medium transition-all hover:bg-red-500/20 flex items-center justify-center"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedWorkflow && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl border border-slate-800 shadow-2xl max-w-4xl w-full my-8 overflow-hidden">
            {/* Modal Header */}
            <div className="relative p-8 border-b border-slate-800">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-pink-600/10"></div>
              <div className="relative flex items-start justify-between">
                <div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                    {selectedWorkflow.name}
                  </h2>
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold ${
                    selectedWorkflow.active 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : 'bg-slate-700/50 text-slate-400 border border-slate-700'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${selectedWorkflow.active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></div>
                    {selectedWorkflow.active ? 'Active' : 'Inactive'}
                  </div>
                </div>
                <button 
                  onClick={() => setShowDetailModal(false)} 
                  className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6 text-slate-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-8">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-20">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-transparent border-t-purple-500 rounded-full animate-spin"></div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Information Section */}
                  <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                      <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Information
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-slate-400 mb-2 block">Description</label>
                        <div className="bg-slate-950/50 rounded-lg p-4 border border-slate-800">
                          <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {getFirstNodeNotes(selectedWorkflow)}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-slate-950/50 rounded-lg p-4 border border-slate-800">
                          <label className="text-xs font-medium text-slate-400 mb-1 block">Created</label>
                          <p className="text-white font-medium">{new Date(selectedWorkflow.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="bg-slate-950/50 rounded-lg p-4 border border-slate-800">
                          <label className="text-xs font-medium text-slate-400 mb-1 block">Updated</label>
                          <p className="text-white font-medium">{new Date(selectedWorkflow.updated_at).toLocaleDateString()}</p>
                        </div>
                        <div className="bg-slate-950/50 rounded-lg p-4 border border-slate-800">
                          <label className="text-xs font-medium text-slate-400 mb-1 block">Status</label>
                          <p className="text-white font-medium">{selectedWorkflow.active ? 'Active' : 'Inactive'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Nodes Section */}
                  {selectedWorkflow.n8n_data?.nodes && (
                    <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
                      <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                        </svg>
                        Nodes
                        <span className="ml-2 px-2 py-0.5 bg-purple-500/20 text-purple-400 text-sm rounded-full font-bold">
                          {selectedWorkflow.n8n_data.nodes.length}
                        </span>
                      </h3>
                      <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                        {selectedWorkflow.n8n_data.nodes.map((node, i) => (
                          <div key={i} className="bg-slate-950/50 rounded-lg p-4 border border-slate-800 hover:border-purple-500/30 transition-colors">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-white font-semibold mb-1">{node.name}</p>
                                <p className="text-xs text-slate-400 font-mono">
                                  {node.type.replace(/^n8n-nodes-/, '')}
                                </p>
                              </div>
                              <div className="w-10 h-10 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-lg flex items-center justify-center border border-purple-500/20">
                                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Close Button */}
                  <button 
                    onClick={() => setShowDetailModal(false)} 
                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl font-semibold transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.5);
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

export default AutomationsLibrary;
