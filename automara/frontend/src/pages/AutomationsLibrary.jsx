import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useBilling, ADDITIONAL_AUTOMATION_PRICE } from '../context/BillingContext';
import StripePaymentModal from '../components/StripePaymentModal';

function AutomationsLibrary() {
  const [searchParams] = useSearchParams();
  const [workflows, setWorkflows] = useState([]);
  const [myWorkflows, setMyWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'library');
  const [syncing, setSyncing] = useState(false);
  const [activating, setActivating] = useState(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [workflowDetails, setWorkflowDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [togglingWorkflow, setTogglingWorkflow] = useState(false);
  const [togglingCardWorkflow, setTogglingCardWorkflow] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [purchasingWorkflow, setPurchasingWorkflow] = useState(null);

  // Get user from localStorage at the component level
  const user = JSON.parse(localStorage.getItem('user'));

  // Billing context
  const {
    getTotalAllowedAutomations,
    setActiveWorkflowCount,
    purchaseAutomation,
    purchasedAutomations
  } = useBilling();

  useEffect(() => {
    fetchWorkflows();
    
    // Auto-sync every 10 seconds
    const syncInterval = setInterval(() => {
      handleSyncN8N();
    }, 10000);
    
    return () => clearInterval(syncInterval);
  }, []);

  const getAuthHeaders = () => {
    return {
      'x-user-id': user?.id?.toString() || '',
      'x-user-role': user?.role || 'client_user',
      'x-tenant-id': user?.tenantId?.toString() || '',
    };
  };

  const getWorkflowDescription = (workflow, truncate = true) => {
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
          const fullNotes = nodeWithNotes.notes.trim();
          if (!truncate) {
            return fullNotes;
          }
          const words = fullNotes.split(/\s+/);
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

      const libraryTemplates = templatesResponse.data.templates || [];
      const userWorkflows = workflowsResponse.data.workflows || [];

      setWorkflows(libraryTemplates);
      setMyWorkflows(userWorkflows);
      // Update active workflow count for billing
      setActiveWorkflowCount(userWorkflows.length);
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

  const handleSyncN8N = async (showAlert = false) => {
    try {
      setSyncing(true);
      await axios.post(
        '/api/workflows/sync',
        {},
        { headers: getAuthHeaders() }
      );
      if (showAlert) {
        alert('Workflows synced successfully!');
      }
      await fetchWorkflows();
    } catch (error) {
      console.error('Error syncing workflows:', error);
      if (showAlert) {
        alert(
          'Failed to sync workflows: ' +
            (error.response?.data?.error || error.message)
        );
      }
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
          `Workflow Activated Successfully!\n\n` +
          `Name: ${response.data.workflow.name}\n` +
          `Folder: ${response.data.workflow.folder}\n\n` +
          `Your company-specific workflow has been created and is ready to use.`
        );
        await fetchWorkflows();
        setActiveTab('my-workflows');
      }
    } catch (error) {
      console.error('Error activating workflow:', error);
      
      // Handle duplicate workflow error
      if (error.response?.status === 409) {
        alert(
          `ℹ️ Workflow Already Activated\n\n` +
          `This workflow has already been activated for your company.\n` +
          `Check the "My Workflows" tab to view it.`
        );
        setActiveTab('my-workflows');
      } else {
        alert(
          'Failed to activate workflow: ' +
            (error.response?.data?.error || error.response?.data?.message || error.message)
        );
      }
    } finally {
      setActivating(null);
    }
  };

  const handleRemoveWorkflow = async (workflowId) => {
    if (!window.confirm('Are you sure you want to deactivate this workflow? This will remove it from your workflows and you can reactivate it later from the Library.'))
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
      alert('Workflow deactivated successfully! You can reactivate it from the Library.');
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

  const handleToggleWorkflowStatus = async () => {
    if (!selectedWorkflow) return;

    try {
      setTogglingWorkflow(true);
      const endpoint = selectedWorkflow.active
        ? `/api/workflows/${selectedWorkflow.id}/stop`
        : `/api/workflows/${selectedWorkflow.id}/start`;

      const response = await axios.post(endpoint, {}, {
        headers: getAuthHeaders(),
      });

      if (response.data.success) {
        // Update local state
        setSelectedWorkflow({
          ...selectedWorkflow,
          active: !selectedWorkflow.active
        });
        await fetchWorkflows();
      }
    } catch (error) {
      console.error('Error toggling workflow:', error);
      alert(
        'Failed to toggle workflow: ' +
          (error.response?.data?.error || error.message)
      );
    } finally {
      setTogglingWorkflow(false);
    }
  };

  const handleCardToggleWorkflow = async (e, workflow) => {
    e.stopPropagation();

    try {
      setTogglingCardWorkflow(workflow.id);
      const endpoint = workflow.active
        ? `/api/workflows/${workflow.id}/stop`
        : `/api/workflows/${workflow.id}/start`;

      const response = await axios.post(endpoint, {}, {
        headers: getAuthHeaders(),
      });

      if (response.data.success) {
        await fetchWorkflows();
      }
    } catch (error) {
      console.error('Error toggling workflow:', error);
      alert(
        'Failed to toggle workflow: ' +
          (error.response?.data?.error || error.message)
      );
    } finally {
      setTogglingCardWorkflow(null);
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

  // Check if workflow needs purchase (exceeds plan limit)
  const needsPurchase = (workflowId) => {
    const allowedCount = getTotalAllowedAutomations();
    // If already purchased, no need to purchase again
    if (purchasedAutomations.includes(workflowId)) return false;
    // If under limit, no purchase needed
    if (myWorkflows.length < allowedCount) return false;
    return true;
  };

  const handlePurchaseClick = (workflow) => {
    setPurchasingWorkflow(workflow);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = async () => {
    if (purchasingWorkflow) {
      purchaseAutomation(purchasingWorkflow.id);
      setShowPaymentModal(false);
      // Now activate the workflow
      await handleActivateWorkflow(purchasingWorkflow.id);
      setPurchasingWorkflow(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-theme-primary/30 rounded-full" />
            <div className="absolute inset-0 border-4 border-transparent border-t-theme-primary rounded-full animate-spin" />
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
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-theme-accent via-theme-accent-alt to-theme-accent bg-clip-text text-transparent mb-2">
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
              onClick={() => handleSyncN8N(true)}
              disabled={syncing}
              className="group px-6 py-3 bg-gradient-to-r from-theme-primary-dark to-theme-secondary-dark rounded-xl font-semibold shadow-lg shadow-theme-primary/25 hover:shadow-theme-primary/40 transition-all duration-300 hover:scale-105 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
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
                  ? 'bg-gradient-to-r from-theme-primary-dark to-theme-secondary-dark text-white shadow-md shadow-theme-primary/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Library ({workflows.length})
            </button>
            <button
              onClick={() => setActiveTab('my-workflows')}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'my-workflows'
                  ? 'bg-gradient-to-r from-theme-primary-dark to-theme-secondary-dark text-white shadow-md shadow-theme-primary/30'
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
            <div className="w-16 h-16 mx-auto mb-5 bg-gradient-to-br from-theme-primary-dark/20 to-theme-secondary-dark/20 rounded-2xl flex items-center justify-center border border-theme-primary/20">
              <svg
                className="w-8 h-8 text-theme-accent"
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
                  ? () => handleSyncN8N(true)
                  : () => setActiveTab('library')
              }
              className="px-8 py-3 bg-gradient-to-r from-theme-primary-dark to-theme-secondary-dark rounded-xl font-semibold shadow-lg shadow-theme-primary/25 hover:shadow-theme-primary/40 transition-all hover:scale-105"
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
                onClick={() => fetchWorkflowDetails(workflow)}
                className="group relative bg-gradient-to-br from-slate-900/55 to-slate-900/25 backdrop-blur-sm rounded-2xl border border-slate-800 hover:border-theme-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-theme-primary/10 hover:-translate-y-1 overflow-hidden cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-theme-primary-dark/0 via-theme-primary-dark/0 to-theme-secondary-dark/0 group-hover:from-theme-primary-dark/5 group-hover:to-theme-secondary-dark/5 transition-all duration-300" />
                <div className="relative p-6 flex flex-col h-full">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4 gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-theme-primary-dark/20 to-theme-secondary-dark/20 rounded-xl flex items-center justify-center border border-theme-primary/20 text-white font-bold text-lg">
                        {workflow.name?.charAt(0) || 'A'}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-theme-accent group-hover:to-theme-accent-alt group-hover:bg-clip-text transition-all">
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
                        <span className="px-2.5 py-1 rounded-full text-[9px] font-semibold bg-theme-primary/10 text-theme-accent border border-theme-primary/25">
                          TEMPLATE
                        </span>
                      ) : (
                        <span
                          className={`px-2.5 py-1 rounded-full text-[9px] font-semibold border inline-flex items-center gap-1.5 ${
                            workflow.active
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                              : 'bg-red-500/10 text-red-400 border-red-500/25'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              workflow.active
                                ? 'bg-emerald-400 animate-pulse'
                                : 'bg-red-400'
                            }`}
                          />
                          {workflow.active ? 'Running' : 'Stopped'}
                        </span>
                      )}
                      {workflow.folder_name && (
                        <span className="px-2 py-0.5 rounded-full text-[8px] font-semibold bg-slate-900/80 text-theme-accent/80 border border-theme-primary/20">
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
                    {/* Time Estimates */}
                    {(workflow.manual_time_minutes || workflow.n8n_time_seconds) && (
                      <div className="flex items-center gap-3 pt-1">
                        {workflow.manual_time_minutes && (
                          <div className="flex items-center gap-1.5 text-amber-400/80">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span>{workflow.manual_time_minutes}m manual</span>
                          </div>
                        )}
                        {workflow.n8n_time_seconds && (
                          <div className="flex items-center gap-1.5 text-emerald-400/80">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span>{workflow.n8n_time_seconds}s auto</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-auto pt-3 border-t border-slate-800 flex gap-2">
                    {activeTab === 'library' ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            fetchWorkflowDetails(workflow);
                          }}
                          className="flex-1 px-3 py-2 bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-xs rounded-xl border border-slate-700 hover:border-theme-primary/40 transition-all flex items-center justify-center gap-1.5"
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
                        {needsPurchase(workflow.id) ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePurchaseClick(workflow);
                            }}
                            className="flex-1 px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-xs rounded-xl font-semibold shadow-md shadow-amber-500/25 hover:shadow-amber-500/40 transition-all flex items-center justify-center gap-1.5"
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
                                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                              />
                            </svg>
                            <span>${ADDITIONAL_AUTOMATION_PRICE}/mo</span>
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleActivateWorkflow(workflow.id);
                            }}
                            disabled={activating === workflow.id}
                            className="flex-1 px-3 py-2 bg-gradient-to-r from-theme-primary-dark to-theme-secondary-dark hover:from-theme-primary hover:to-theme-secondary text-white text-xs rounded-xl font-semibold shadow-md shadow-theme-primary/25 hover:shadow-theme-primary/40 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
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
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          onClick={(e) => handleCardToggleWorkflow(e, workflow)}
                          disabled={togglingCardWorkflow === workflow.id}
                          className={`flex-1 px-3 py-2 text-xs rounded-xl font-semibold border transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 ${
                            workflow.active
                              ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30'
                              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {togglingCardWorkflow === workflow.id ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-current/40 border-t-current rounded-full animate-spin" />
                              <span>{workflow.active ? 'Stopping...' : 'Starting...'}</span>
                            </>
                          ) : (
                            <>
                              {workflow.active ? (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              )}
                              <span>{workflow.active ? 'Stop' : 'Start'}</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveWorkflow(workflow.id);
                          }}
                          disabled={activating === workflow.id}
                          className="px-3 py-2 bg-slate-700/40 hover:bg-slate-700/60 text-slate-400 text-xs rounded-xl font-semibold border border-slate-600/40 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                        >
                          {activating === workflow.id ? (
                            <div className="w-3.5 h-3.5 border-2 border-slate-400/40 border-t-slate-400 rounded-full animate-spin" />
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
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
                <div className="absolute inset-0 bg-gradient-to-r from-theme-primary-dark/10 to-theme-secondary-dark/10" />
                <div className="relative flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-theme-primary-dark to-theme-secondary-dark rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-theme-primary/30">
                      {selectedWorkflow.name?.charAt(0) || 'A'}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-theme-accent to-theme-accent-alt bg-clip-text text-transparent">
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
                      <div className="absolute inset-0 border-4 border-theme-primary/30 rounded-full" />
                      <div className="absolute inset-0 border-4 border-transparent border-t-theme-primary rounded-full animate-spin" />
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
                              let descriptionText = '';

                              // Try to get notes from workflowDetails - find first node with notes
                              if (workflowDetails?.nodes) {
                                const nodeWithNotes = workflowDetails.nodes.find(
                                  (node) => node.notes && node.notes.trim()
                                );
                                if (nodeWithNotes?.notes) {
                                  descriptionText = nodeWithNotes.notes;
                                }
                              }

                              // Fall back to selectedWorkflow.n8n_data
                              if (!descriptionText) {
                                descriptionText = getWorkflowDescription(selectedWorkflow, false);
                              }

                              if (descriptionText && descriptionText !== 'Automation workflow template') {
                                const lines = descriptionText.split('\n');
                                const isLong = lines.length > 3 || descriptionText.length > 200;
                                const displayText = descriptionExpanded
                                  ? descriptionText
                                  : lines.slice(0, 3).join('\n').substring(0, 200) + (isLong ? '...' : '');

                                return (
                                  <div>
                                    <p className="text-slate-200 bg-slate-900/90 rounded-lg p-4 border border-slate-800 whitespace-pre-wrap">
                                      {displayText}
                                    </p>
                                    {isLong && (
                                      <button
                                        onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                                        className="mt-2 text-theme-accent hover:text-theme-accent/80 text-xs font-medium"
                                      >
                                        {descriptionExpanded ? 'Show less' : 'Show more...'}
                                      </button>
                                    )}
                                  </div>
                                );
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
                        {getWorkflowDescription(selectedWorkflow, false)}
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

                    {/* Time Estimates */}
                    {(selectedWorkflow.manual_time_minutes || selectedWorkflow.n8n_time_seconds) && (
                      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                          Time Savings
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          {selectedWorkflow.manual_time_minutes && (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span className="text-xs text-amber-400 font-semibold">Manual Time</span>
                              </div>
                              <p className="text-2xl font-bold text-amber-300">{selectedWorkflow.manual_time_minutes} min</p>
                              <p className="text-xs text-amber-400/70 mt-1">Human effort required</p>
                            </div>
                          )}
                          {selectedWorkflow.n8n_time_seconds && (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                <span className="text-xs text-emerald-400 font-semibold">Automation Time</span>
                              </div>
                              <p className="text-2xl font-bold text-emerald-300">{selectedWorkflow.n8n_time_seconds} sec</p>
                              <p className="text-xs text-emerald-400/70 mt-1">n8n execution time</p>
                            </div>
                          )}
                        </div>
                        {selectedWorkflow.manual_time_minutes && selectedWorkflow.n8n_time_seconds && (
                          <div className="mt-4 pt-4 border-t border-slate-700">
                            <p className="text-sm text-slate-400">
                              Time saved: <span className="text-emerald-400 font-semibold">
                                {Math.round((selectedWorkflow.manual_time_minutes * 60 - selectedWorkflow.n8n_time_seconds) / 60)} min
                              </span> per execution
                            </p>
                          </div>
                        )}
                      </div>
                    )}

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
                                  className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-theme-primary/40 transition-all"
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
                                    <span className="px-2.5 py-1 rounded-full text-[9px] font-semibold bg-theme-primary/10 text-theme-accent/80 border border-theme-primary/30">
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
                                  <span className="text-theme-accent/80 font-semibold">
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
                    setDescriptionExpanded(false);
                  }}
                  className="flex-1 px-5 py-3 bg-slate-900 hover:bg-slate-800 rounded-xl text-xs font-semibold text-slate-300 border border-slate-700 transition-all"
                >
                  Close
                </button>
                {activeTab === 'my-workflows' && (
                  <button
                    onClick={handleToggleWorkflowStatus}
                    disabled={togglingWorkflow}
                    className={`flex-1 px-5 py-3 rounded-xl text-xs font-semibold shadow-lg transition-all text-center flex items-center justify-center gap-2 ${
                      selectedWorkflow.active
                        ? 'bg-red-500/80 hover:bg-red-600 text-white shadow-red-500/25 hover:shadow-red-500/40'
                        : 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-emerald-500/25 hover:shadow-emerald-500/40'
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    {togglingWorkflow ? (
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : selectedWorkflow.active ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    <span>{selectedWorkflow.active ? 'Stop' : 'Start'}</span>
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-[9px] font-semibold ${
                      selectedWorkflow.active
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-slate-700/60 text-slate-400'
                    }`}>
                      {selectedWorkflow.active ? 'Active' : 'Stopped'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stripe Payment Modal for Additional Automations */}
        <StripePaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setPurchasingWorkflow(null);
          }}
          onSuccess={handlePaymentSuccess}
          paymentType="automation"
          automationDetails={purchasingWorkflow}
        />
      </div>
    </div>
  );
}

export default AutomationsLibrary;