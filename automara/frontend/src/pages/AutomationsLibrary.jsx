import React, { useState, useEffect } from 'react';
import axios from 'axios';

function AutomationsLibrary() {
  const [workflows, setWorkflows] = useState([]);
  const [myWorkflows, setMyWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('library');
  const [syncing, setSyncing] = useState(false);
  const [activating, setActivating] = useState(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [workflowDetails, setWorkflowDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Get user from localStorage at the component level
  const user = JSON.parse(localStorage.getItem('user'));

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const getAuthHeaders = () => {
    return {
      'x-user-id': user?.id?.toString() || '',
      'x-user-role': user?.role || 'client_user',
      'x-tenant-id': user?.tenantId?.toString() || '',
    };
  };

  const getWorkflowDescription = (workflow) => {
    try {
      const data = workflow.n8n_data
        ? typeof workflow.n8n_data === 'string'
          ? JSON.parse(workflow.n8n_data)
          : workflow.n8n_data
        : null;

      if (data && data.nodes && data.nodes.length > 0) {
        const nodeWithNotes = data.nodes.find(
          (node) => node.notes && node.notes.trim()
        );
        if (nodeWithNotes && nodeWithNotes.notes) {
          const words = nodeWithNotes.notes.trim().split(/\s+/);
          return (
            words.slice(0, 16).join(' ') +
            (words.length > 16 ? '...' : '')
          );
        }
      }
      return workflow.description || 'Automation workflow template';
    } catch (error) {
      return workflow.description || 'Automation workflow template';
    }
  };

  const fetchWorkflows = async () => {
    try {
      const [templatesResponse, workflowsResponse] = await Promise.all([
        axios.get('/api/workflows/templates', { headers: getAuthHeaders() }),
        axios.get('/api/workflows', { headers: getAuthHeaders() }),
      ]);

      const allWorkflows = workflowsResponse.data.workflows || [];

      const libraryTemplates = allWorkflows.filter(
        (w) => w.is_template === true || w.tenant_id === null
      );
      const userWorkflows = allWorkflows.filter(
        (w) => w.tenant_id === user?.tenantId
      );

      setWorkflows(libraryTemplates);
      setMyWorkflows(userWorkflows);
    } catch (error) {
      console.error('Error fetching automations:', error);
      alert(
        'Failed to load automations: ' +
          (error.response?.data?.error || error.message)
      );
      setWorkflows([]);
      setMyWorkflows([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkflowDetails = async (workflow) => {
    try {
      setLoadingDetails(true);
      setSelectedWorkflow(workflow);
      setShowInfoModal(true);

      const response = await axios.get(
        `/api/workflows/${workflow.id}/details`,
        {
          headers: getAuthHeaders(),
        }
      );

      setWorkflowDetails(
        response.data.workflow || workflow.n8n_data || null
      );
    } catch (error) {
      console.error('Error fetching workflow details:', error);
      setWorkflowDetails(workflow.n8n_data || null);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSyncN8N = async () => {
    try {
      setSyncing(true);
      await axios.post(
        '/api/workflows/sync',
        {},
        { headers: getAuthHeaders() }
      );
      alert('Workflows synced successfully!');
      await fetchWorkflows();
    } catch (error) {
      console.error('Error syncing workflows:', error);
      alert(
        'Failed to sync workflows: ' +
          (error.response?.data?.error || error.message)
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleActivateWorkflow = async (workflowId) => {
    try {
      setActivating(workflowId);
      const response = await axios.post(
        `/api/workflows/${workflowId}/activate`,
        {},
        {
          headers: getAuthHeaders(),
        }
      );

      if (response.data.success) {
        alert(
          `Workflow activated successfully!\n\nName: ${response.data.workflow.name}\nFolder: ${response.data.workflow.folder}`
        );
        await fetchWorkflows();
        setActiveTab('my-workflows');
      }
    } catch (error) {
      console.error('Error activating workflow:', error);
      alert(
        'Failed to activate workflow: ' +
          (error.response?.data?.message || error.message)
      );
    } finally {
      setActivating(null);
    }
  };

  const handleDeactivateWorkflow = async (workflowId) => {
    if (!window.confirm('Are you sure you want to deactivate this workflow?'))
      return;

    try {
      setActivating(workflowId);
      await axios.post(
        `/api/workflows/${workflowId}/deactivate`,
        {},
        {
          headers: getAuthHeaders(),
        }
      );
      alert('Workflow deactivated successfully!');
      await fetchWorkflows();
    } catch (error) {
      console.error('Error deactivating workflow:', error);
      alert(
        'Failed to deactivate workflow: ' +
          (error.response?.data?.error || error.message)
      );
    } finally {
      setActivating(null);
    }
  };

  const getNodeIcon = (nodeType) => {
    const type = nodeType?.toLowerCase() || '';
    if (type.includes('webhook')) return '🌐';
    if (type.includes('http')) return '📡';
    if (type.includes('email') || type.includes('gmail')) return '📧';
    if (type.includes('slack')) return '💬';
    if (type.includes('database') || type.includes('postgres') || type.includes('mysql'))
      return '🗄️';
    if (type.includes('google')) return '📊';
    if (type.includes('schedule') || type.includes('cron')) return '⏰';
    if (type.includes('code') || type.includes('function')) return '💻';
    if (type.includes('filter') || type.includes('if')) return '🔀';
    if (type.includes('merge') || type.includes('join')) return '🔗';
    if (type.includes('split')) return '✂️';
    if (type.includes('wait')) return '⏳';
    return '⚙️';
  };

  const displayedWorkflows =
    activeTab === 'library' ? workflows : myWorkflows;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full" />
            <div className="absolute inset-0 border-4 border-transparent border-t-purple-500 rounded-full animate-spin" />
          </div>
          <p className="text-slate-400 text-lg font-medium">
            Loading automations...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header + Sync */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent mb-2">
              {activeTab === 'library'
                ? 'Automation Library'
                : 'My Workflows'}
            </h1>
            <p className="text-slate-400 text-lg">
              {activeTab === 'library'
                ? 'Browse, inspect, and activate curated n8n workflow templates.'
                : 'Manage the workflows deployed into your tenant.'}
            </p>
          </div>
            
          {/* Sync with n8n button - only visible to global admins */}
          {user?.role === 'global_admin' && (
            <button
              onClick={handleSyncN8N}
              disabled={syncing}
              className="group px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-semibold shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-300 hover:scale-105 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <svg
                className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v6h6M20 20v-6h-6M5 19A9 9 0 0119 5"
                />
              </svg>
              <span>{syncing ? 'Syncing Workflows...' : 'Sync from n8n'}</span>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="inline-flex p-1 bg-slate-900/60 border border-slate-800 rounded-2xl backdrop-blur-sm">
            <button
              onClick={() => setActiveTab('library')}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'library'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Library ({workflows.length})
            </button>
            <button
              onClick={() => setActiveTab('my-workflows')}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'my-workflows'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              My Workflows ({myWorkflows.length})
            </button>
          </div>
        </div>

        {/* Empty State */}
        {displayedWorkflows.length === 0 ? (
          <div className="mt-8 bg-gradient-to-br from-slate-900/40 to-slate-900/10 backdrop-blur-sm rounded-2xl border border-slate-800 p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-5 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-2xl flex items-center justify-center border border-purple-500/20">
              <svg
                className="w-8 h-8 text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {activeTab === 'library' ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v12m6-6H6"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                )}
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">
              {activeTab === 'library'
                ? 'No workflow templates available'
                : 'No workflows deployed yet'}
            </h3>
            <p className="text-slate-400 mb-6 max-w-xl mx-auto">
              {activeTab === 'library'
                ? 'Sync with your n8n instance to import tagged library workflows.'
                : 'Activate workflows from the Automation Library to see them here.'}
            </p>
            <button
              onClick={
                activeTab === 'library'
                  ? handleSyncN8N
                  : () => setActiveTab('library')
              }
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-semibold shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all hover:scale-105"
            >
              {activeTab === 'library'
                ? 'Sync Workflows from n8n'
                : 'Browse Automation Library'}
            </button>
          </div>
        ) : (
          /* Workflows Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedWorkflows.map((workflow) => (
              <div
                key={workflow.id}
                className="group relative bg-gradient-to-br from-slate-900/55 to-slate-900/25 backdrop-blur-sm rounded-2xl border border-slate-800 hover:border-purple-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-1 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/0 via-purple-600/0 to-pink-600/0 group-hover:from-purple-600/5 group-hover:to-pink-600/5 transition-all duration-300" />
                <div className="relative p-6 flex flex-col h-full">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4 gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-xl flex items-center justify-center border border-purple-500/20 text-white font-bold text-lg">
                        {workflow.name?.charAt(0) || 'A'}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-purple-400 group-hover:to-pink-400 group-hover:bg-clip-text transition-all">
                          {workflow.name}
                        </h3>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                          {activeTab === 'library'
                            ? 'Library Template'
                            : 'Deployed Workflow'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {activeTab === 'library' ? (
                        <span className="px-2.5 py-1 rounded-full text-[9px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/25">
                          TEMPLATE
                        </span>
                      ) : (
                        <span
                          className={`px-2.5 py-1 rounded-full text-[9px] font-semibold border inline-flex items-center gap-1.5 ${
                            workflow.active
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                              : 'bg-slate-700/40 text-slate-400 border-slate-600/40'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              workflow.active
                                ? 'bg-emerald-400 animate-pulse'
                                : 'bg-slate-500'
                            }`}
                          />
                          {workflow.active ? 'Active' : 'Inactive'}
                        </span>
                      )}
                      {workflow.folder_name && (
                        <span className="px-2 py-0.5 rounded-full text-[8px] font-semibold bg-slate-900/80 text-purple-300 border border-purple-500/20">
                          {workflow.folder_name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-slate-400 mb-4 line-clamp-3">
                    {getWorkflowDescription(workflow)}
                  </p>

                  {/* Meta */}
                  <div className="space-y-2 text-[11px] text-slate-500 mb-4">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-3.5 h-3.5 text-slate-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>
                        {activeTab === 'library'
                          ? 'Added'
                          : 'Activated'}{' '}
                        {new Date(
                          activeTab === 'library'
                            ? workflow.created_at
                            : workflow.cloned_at || workflow.created_at
                        ).toLocaleDateString()}
                      </span>
                    </div>
                    {activeTab === 'my-workflows' &&
                      workflow.folder_name && (
                        <div className="flex items-center gap-2">
                          <svg
                            className="w-3.5 h-3.5 text-slate-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 7h18M3 12h18M3 17h18"
                            />
                          </svg>
                          <span>Folder: {workflow.folder_name}</span>
                        </div>
                      )}
                  </div>

                  {/* Actions */}
                  <div className="mt-auto pt-3 border-t border-slate-800 flex gap-2">
                    {activeTab === 'library' ? (
                      <>
                        <button
                          onClick={() => fetchWorkflowDetails(workflow)}
                          className="flex-1 px-3 py-2 bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-xs rounded-xl border border-slate-700 hover:border-purple-500/40 transition-all flex items-center justify-center gap-1.5"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                          Info
                        </button>
                        <button
                          onClick={() =>
                            handleActivateWorkflow(workflow.id)
                          }
                          disabled={activating === workflow.id}
                          className="flex-1 px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-xs rounded-xl font-semibold shadow-md shadow-purple-500/25 hover:shadow-purple-500/40 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                        >
                          {activating === workflow.id ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                              <span>Activating...</span>
                            </>
                          ) : (
                            <>
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 4v16m8-8H4"
                                />
                              </svg>
                              <span>Activate</span>
                            </>
                          )}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => fetchWorkflowDetails(workflow)}
                          className="flex-1 px-3 py-2 bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-xs rounded-xl border border-slate-700 hover:border-purple-500/40 transition-all flex items-center justify-center gap-1.5"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 12h14M5 12l4-4m-4 4l4 4"
                            />
                          </svg>
                          Manage
                        </button>
                        {workflow.active && (
                          <button
                            onClick={() =>
                              handleDeactivateWorkflow(workflow.id)
                            }
                            disabled={activating === workflow.id}
                            className="flex-1 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs rounded-xl font-semibold border border-blue-500/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                          >
                            {activating === workflow.id ? (
                              <>
                                <div className="w-3.5 h-3.5 border-2 border-blue-300/40 border-t-blue-300 rounded-full animate-spin" />
                                <span>Pausing...</span>
                              </>
                            ) : (
                              <>
                                <svg
                                  className="w-3.5 h-3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10 9v6m4-6v6"
                                  />
                                </svg>
                                <span>Pause</span>
                              </>
                            )}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Workflow Info Modal */}
        {showInfoModal && selectedWorkflow && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl border border-slate-800 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="relative p-8 border-b border-slate-800">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-pink-600/10" />
                <div className="relative flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-purple-500/30">
                      {selectedWorkflow.name?.charAt(0) || 'A'}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        {selectedWorkflow.name}
                      </h2>
                      <p className="text-slate-400 text-xs">
                        Workflow details & structure
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowInfoModal(false);
                      setSelectedWorkflow(null);
                      setWorkflowDetails(null);
                    }}
                    className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <svg
                      className="w-6 h-6 text-slate-300 hover:text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-8 space-y-6">
                {loadingDetails ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="relative w-16 h-16">
                      <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full" />
                      <div className="absolute inset-0 border-4 border-transparent border-t-purple-500 rounded-full animate-spin" />
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Full Description */}
                    {workflowDetails &&
                      workflowDetails.nodes &&
                      workflowDetails.nodes.length > 0 && (
                        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
                          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                            Full Description
                          </h3>
                          <div className="text-sm">
                            {(() => {
                              // Try to get notes from workflowDetails first
                              if (workflowDetails?.nodes?.[0]?.notes) {
                                return (
                                  <p className="text-slate-200 bg-slate-900/90 rounded-lg p-4 border border-slate-800 whitespace-pre-wrap">
                                    {workflowDetails.nodes[0].notes}
                                  </p>
                                );
                              }
                              
                              // Fall back to selectedWorkflow.n8n_data
                              try {
                                const data = selectedWorkflow.n8n_data
                                  ? typeof selectedWorkflow.n8n_data === 'string'
                                    ? JSON.parse(selectedWorkflow.n8n_data)
                                    : selectedWorkflow.n8n_data
                                  : null;
                                
                                if (data?.nodes?.[0]?.notes) {
                                  return (
                                    <p className="text-slate-200 bg-slate-900/90 rounded-lg p-4 border border-slate-800 whitespace-pre-wrap">
                                      {data.nodes[0].notes}
                                    </p>
                                  );
                                }
                              } catch (error) {
                                console.error('Error parsing workflow data:', error);
                              }
                              
                              return (
                                <p className="text-slate-500 italic">
                                  No description available for this workflow.
                                </p>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                    {/* Basic Info */}
                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
                      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                        Workflow Overview
                      </h3>
                      <p className="text-slate-300 whitespace-pre-wrap">
                        {getWorkflowDescription(selectedWorkflow)}
                      </p>
                    </div>

                    {/* Status */}
                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
                      <p className="text-slate-500">Status</p>
                      <div className="mt-1">
                        <span
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border inline-flex items-center gap-1.5 ${
                            selectedWorkflow.active
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                              : 'bg-slate-700/40 text-slate-400 border-slate-600/40'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              selectedWorkflow.active
                                ? 'bg-emerald-400 animate-pulse'
                                : 'bg-slate-500'
                            }`}
                          />
                          {selectedWorkflow.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>

                    {/* Steps */}
                    {workflowDetails &&
                      workflowDetails.nodes &&
                      workflowDetails.nodes.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="text-base font-semibold text-white">
                            Workflow Steps (
                            {workflowDetails.nodes.length} steps)
                          </h3>
                          <div className="grid grid-cols-1 gap-4">
                            {workflowDetails.nodes.map(
                              (node, index) => (
                                <div
                                  key={node.id || index}
                                  className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-purple-500/40 transition-all"
                                >
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-gradient-to-br from-blue-600/40 to-purple-600/40 rounded-xl flex items-center justify-center text-2xl">
                                        {getNodeIcon(node.type)}
                                      </div>
                                      <div>
                                        <h4 className="text-sm font-semibold text-white">
                                          {node.name}
                                        </h4>
                                        <p className="text-[10px] text-slate-500">
                                          {node.type}
                                        </p>
                                      </div>
                                    </div>
                                    <span className="px-2.5 py-1 rounded-full text-[9px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30">
                                      Step {index + 1}
                                    </span>
                                  </div>

                                  {node.notes && (
                                    <div className="mb-3">
                                      <p className="text-[10px] text-slate-500 mb-1">
                                        Notes
                                      </p>
                                      <p className="text-xs text-slate-200 bg-slate-900/90 rounded-lg p-3 border border-slate-800">
                                        {node.notes}
                                      </p>
                                    </div>
                                  )}

                                  {node.parameters &&
                                    Object.keys(
                                      node.parameters
                                    ).length > 0 && (
                                      <div className="mb-3">
                                        <p className="text-[10px] text-slate-500 mb-1">
                                          Key Configuration
                                        </p>
                                        <div className="space-y-1.5 text-[10px] text-slate-300">
                                          {Object.entries(
                                            node.parameters
                                          )
                                            .slice(0, 5)
                                            .map(
                                              ([
                                                key,
                                                value,
                                              ]) => (
                                                <div
                                                  key={key}
                                                  className="flex gap-2"
                                                >
                                                  <span className="text-slate-500 font-mono min-w-[90px]">
                                                    {key}:
                                                  </span>
                                                  <span className="flex-1 break-all">
                                                    {typeof value ===
                                                    'object'
                                                      ? JSON.stringify(
                                                          value
                                                        )
                                                      : String(
                                                          value
                                                        )}
                                                  </span>
                                                </div>
                                              )
                                            )}
                                          {Object.keys(
                                            node.parameters
                                          ).length > 5 && (
                                            <p className="text-[9px] text-slate-500 italic">
                                              +{' '}
                                              {Object.keys(
                                                node.parameters
                                              ).length - 5}{' '}
                                              more parameters
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                  <div className="flex flex-wrap gap-3 text-[9px] text-slate-500 pt-2 border-t border-slate-800">
                                    <span>
                                      Position: (
                                      {node.position?.[0] || 0},{' '}
                                      {node.position?.[1] || 0})
                                    </span>
                                    {node.disabled && (
                                      <span className="text-amber-400">
                                        Disabled
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                    {/* Connections */}
                    {workflowDetails &&
                      workflowDetails.connections &&
                      Object.keys(
                        workflowDetails.connections
                      ).length > 0 && (
                        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
                          <h3 className="text-base font-semibold text-white mb-3">
                            Node Connections
                          </h3>
                          <div className="space-y-1.5 text-[10px] text-slate-300">
                            {Object.entries(
                              workflowDetails.connections
                            ).map(
                              ([
                                nodeName,
                                connections,
                              ]) => (
                                <div key={nodeName}>
                                  <span className="text-purple-300 font-semibold">
                                    {nodeName}
                                  </span>
                                  <span className="text-slate-500">
                                    {' '}
                                    →{' '}
                                  </span>
                                  <span>
                                    {Object.values(
                                      connections
                                    )
                                      .flat()
                                      .map((connArr) =>
                                        connArr
                                          .map(
                                            (c) =>
                                              c.node
                                          )
                                          .join(', ')
                                      )
                                      .join(', ')}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                  </>
                )}
              </div>



              {/* Modal Footer */}
              <div className="flex flex-col md:flex-row gap-3 p-6 border-t border-slate-800 bg-slate-950/80">
                <button
                  onClick={() => {
                    setShowInfoModal(false);
                    setSelectedWorkflow(null);
                    setWorkflowDetails(null);
                  }}
                  className="flex-1 px-5 py-3 bg-slate-900 hover:bg-slate-800 rounded-xl text-xs font-semibold text-slate-300 border border-slate-700 transition-all"
                >
                  Close
                </button>
                <a
                  href={`${
                    process.env.REACT_APP_N8N_URL ||
                    'http://localhost:5678'
                  }/workflow/${
                    selectedWorkflow.n8n_workflow_id || ''
                  }`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-5 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl text-xs font-semibold text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all text-center flex items-center justify-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 3h7m0 0v7m0-7L10 14"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 5v14h14"
                    />
                  </svg>
                  <span>Open in n8n</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AutomationsLibrary;