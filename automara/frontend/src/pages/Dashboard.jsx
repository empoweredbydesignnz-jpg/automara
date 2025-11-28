import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Dashboard({ tenant }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTenants: 0,
    activeWorkflows: 0,
    apiCalls: 0,
    openTickets: 0,
    totalTickets: 0
  });
  const [ticketStats, setTicketStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workflows, setWorkflows] = useState([]);
  const [workflowTimings, setWorkflowTimings] = useState({});
  const [workflowExecutions, setWorkflowExecutions] = useState({});
  const [selectedError, setSelectedError] = useState(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [allWorkflowErrors, setAllWorkflowErrors] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchWorkflowExecutions = async (workflowsData, user) => {
    const executions = {};
    const errors = [];
    const allActivities = [];

    // Fetch executions for active workflows only
    const activeWorkflows = workflowsData.filter(w => w.active);

    for (const workflow of activeWorkflows) {
      try {
        const response = await axios.get(`/api/workflows/${workflow.id}/executions`, {
          params: { limit: 10 }, // Get last 10 executions for recent activity
          headers: {
            'x-user-role': user?.role || 'client_user',
            'x-tenant-id': user?.tenantId || '',
            'x-user-id': user?.id || ''
          }
        });

        if (response.data.success && response.data.executions.length > 0) {
          const latestExecution = response.data.executions[0];
          executions[workflow.id] = latestExecution;

          // DEBUG: Log execution data
          if (latestExecution.status === 'error') {
            console.log('[DASHBOARD] Error execution for workflow:', workflow.name);
            console.log('[DASHBOARD] Full execution object:', JSON.stringify(latestExecution, null, 2));
            console.log('[DASHBOARD] Error object:', latestExecution.error);
          }

          // Collect errors for global admin dashboard
          if (latestExecution.status === 'error' && latestExecution.error) {
            errors.push({
              workflow: workflow,
              execution: latestExecution
            });
          }

          // Collect all executions for recent activity
          response.data.executions.forEach(execution => {
            allActivities.push({
              workflow: workflow,
              execution: execution
            });
          });
        }
      } catch (error) {
        console.error(`Error fetching executions for workflow ${workflow.id}:`, error);
      }
    }

    setWorkflowExecutions(executions);
    setAllWorkflowErrors(errors);

    // Sort recent activity by start time (most recent first) and take top 10
    const sortedActivity = allActivities.sort((a, b) => {
      const timeA = new Date(a.execution.startedAt).getTime();
      const timeB = new Date(b.execution.startedAt).getTime();
      return timeB - timeA;
    }).slice(0, 10);

    setRecentActivity(sortedActivity);
  };

  const fetchStats = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user'));

      // Fetch users count
      const usersResponse = await axios.get('/api/users', {
        headers: {
          'x-user-role': user?.role || 'client_user',
          'x-tenant-id': user?.tenantId || ''
        }
      });
      const totalUsers = usersResponse.data.users?.length || 0;

      // Fetch tenants count (for admin only)
      let totalTenants = 0;
      if (user?.role === 'global_admin') {
        const tenantsResponse = await axios.get('/api/tenants', {
          headers: {
            'x-user-role': user?.role || 'client_user',
            'x-tenant-id': user?.tenantId || ''
          }
        });
        totalTenants = tenantsResponse.data.tenants?.length || 0;
      }

      // Fetch workflows count for the tenant
      let activeWorkflows = 0;
      let workflowsData = [];
      if (user?.tenantId) {
        try {
          const workflowsResponse = await axios.get('/api/workflows', {
            headers: {
              'x-user-role': user?.role || 'client_user',
              'x-tenant-id': user?.tenantId || ''
            }
          });
          workflowsData = workflowsResponse.data.workflows || [];
          activeWorkflows = workflowsData.filter(w => w.active).length;
          setWorkflows(workflowsData);

          // Initialize timing data for active workflows
          // Get persisted start times from localStorage
          const savedTimings = JSON.parse(localStorage.getItem('workflow-timings') || '{}');

          const timings = {};
          workflowsData.forEach(workflow => {
            const savedTiming = savedTimings[workflow.id];

            const wasActiveInSavedTimings = savedTiming?.startTime !== null && savedTiming?.startTime !== undefined;

            if (workflow.active) {
              let startTime;
              let wasJustStarted = false;

              // Priority 1: Use backend startedAt timestamp if available (most reliable)
              if (workflow.startedAt) {
                startTime = new Date(workflow.startedAt).getTime();
                console.log(`Workflow "${workflow.name}": Using backend startedAt timestamp`);
              }
              // Priority 2: If workflow was already active with a saved start time, keep it
              else if (wasActiveInSavedTimings && savedTiming.startTime) {
                startTime = savedTiming.startTime;
                console.log(`Workflow "${workflow.name}": Using saved start time (was already active)`);
              }
              // Priority 3: Workflow just became active - record the current time
              else if (!wasActiveInSavedTimings) {
                startTime = Date.now();
                wasJustStarted = true;
                console.log(`Workflow "${workflow.name}": [JUST STARTED] - Recording new start time: ${new Date(startTime).toLocaleString()}`);
              }
              // Fallback: shouldn't reach here, but use current time
              else {
                startTime = Date.now();
                console.warn(`Workflow "${workflow.name}": Fallback - using current time`);
              }

              timings[workflow.id] = {
                startTime: startTime,
                elapsedTime: Date.now() - startTime,
                history: savedTiming?.history || []
              };

              // Log for debugging
              const elapsed = Math.floor((Date.now() - startTime) / 1000);
              console.log(`  └─ Start: ${new Date(startTime).toLocaleString()} | Elapsed: ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
            } else {
              // Workflow is not active - clear its timing
              if (wasActiveInSavedTimings) {
                console.log(`Workflow "${workflow.name}": Stopped - clearing timing`);
              }
              timings[workflow.id] = {
                startTime: null,
                elapsedTime: 0,
                history: savedTiming?.history || []
              };
            }
          });

          // Save timings to localStorage
          localStorage.setItem('workflow-timings', JSON.stringify(timings));
          setWorkflowTimings(timings);

          // Fetch executions for active workflows
          fetchWorkflowExecutions(workflowsData, user);
        } catch (err) {
          console.error('Error fetching workflows:', err);
        }
      }

      // Fetch ticket stats for the tenant
      let openTickets = 0;
      let totalTickets = 0;
      let fullTicketStats = null;
      try {
        const ticketStatsResponse = await axios.get('/api/tickets/stats', {
          headers: {
            'x-user-role': user?.role || 'client_user',
            'x-tenant-id': user?.tenantId || '',
            'x-user-id': user?.id || ''
          }
        });
        const ticketStatsData = ticketStatsResponse.data.stats;
        openTickets = parseInt(ticketStatsData?.open || 0);
        totalTickets = parseInt(ticketStatsData?.total || 0);

        // Store full stats for global admin
        if (user?.role === 'global_admin') {
          fullTicketStats = ticketStatsData;
        }
      } catch (err) {
        console.error('Error fetching ticket stats:', err);
      }

      setTicketStats(fullTicketStats);

      setStats({
        totalUsers,
        totalTenants,
        activeWorkflows,
        apiCalls: 0, // TODO: Add tracking
        openTickets,
        totalTickets
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Update workflow timings every second
  useEffect(() => {
    const interval = setInterval(() => {
      setWorkflowTimings(prev => {
        const updated = { ...prev };
        workflows.forEach(workflow => {
          if (workflow.active && updated[workflow.id]?.startTime) {
            updated[workflow.id] = {
              ...updated[workflow.id],
              elapsedTime: Date.now() - updated[workflow.id].startTime
            };
          }
        });
        // Save updated timings to localStorage
        localStorage.setItem('workflow-timings', JSON.stringify(updated));
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [workflows]);

  // Fetch workflow executions every 30 seconds
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));

    const interval = setInterval(() => {
      if (workflows.length > 0) {
        fetchWorkflowExecutions(workflows, user);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [workflows]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-theme-primary/30 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-theme-primary rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-400 text-lg font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-theme-accent via-theme-accent-alt to-theme-accent bg-clip-text text-transparent mb-3">
            Dashboard
          </h1>
          <p className="text-slate-400 text-lg">
            {tenant ? `Welcome ${tenant.name}` : 'System Overview'}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* Total Users Card */}
          <div className="group relative bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-2xl border border-slate-800 hover:border-theme-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-theme-primary/10 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-theme-primary-dark/0 via-theme-primary-dark/0 to-theme-secondary-dark/0 group-hover:from-theme-primary-dark/10 group-hover:to-theme-secondary-dark/10 transition-all duration-300"></div>
            <div className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-theme-primary-dark/20 to-theme-secondary-dark/20 rounded-xl flex items-center justify-center border border-theme-primary/20">
                  <svg className="w-6 h-6 text-theme-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div className="px-3 py-1 bg-theme-primary/10 text-theme-accent rounded-full text-xs font-bold border border-theme-primary/20">
                  Active
                </div>
              </div>
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1">Total Users</p>
                <p className="text-4xl font-bold bg-gradient-to-r from-theme-accent to-theme-accent-alt bg-clip-text text-transparent">
                  {stats.totalUsers}
                </p>
              </div>
            </div>
          </div>

          {/* Total Tenants Card - Only show for global admin */}
          {stats.totalTenants > 0 && (
            <div className="group relative bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-2xl border border-slate-800 hover:border-blue-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/0 via-blue-600/0 to-cyan-600/0 group-hover:from-blue-600/10 group-hover:to-cyan-600/10 transition-all duration-300"></div>
              <div className="relative p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 rounded-xl flex items-center justify-center border border-blue-500/20">
                    <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-xs font-bold border border-blue-500/20">
                    System
                  </div>
                </div>
                <div>
                  <p className="text-slate-400 text-sm font-medium mb-1">Total Tenants</p>
                  <p className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    {stats.totalTenants}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Active Workflows Card */}
          <div
            onClick={() => navigate('/automations?tab=my-workflows')}
            className="group relative bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-2xl border border-slate-800 hover:border-emerald-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/10 overflow-hidden cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/0 via-emerald-600/0 to-teal-600/0 group-hover:from-emerald-600/10 group-hover:to-teal-600/10 transition-all duration-300"></div>
            <div className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-600/20 to-teal-600/20 rounded-xl flex items-center justify-center border border-emerald-500/20">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-bold border border-emerald-500/20">
                  Running
                </div>
              </div>
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1">Active Workflows</p>
                <p className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  {stats.activeWorkflows}
                </p>
              </div>
            </div>
          </div>

          {/* Support Tickets Card */}
          <div
            onClick={() => navigate('/tickets')}
            className="group relative bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-2xl border border-slate-800 hover:border-purple-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10 overflow-hidden cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/0 via-purple-600/0 to-pink-600/0 group-hover:from-purple-600/10 group-hover:to-pink-600/10 transition-all duration-300"></div>
            <div className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-xl flex items-center justify-center border border-purple-500/20">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                </div>
                {stats.openTickets > 0 ? (
                  <div className="px-3 py-1 bg-purple-500/10 text-purple-400 rounded-full text-xs font-bold border border-purple-500/20">
                    {stats.openTickets} Open
                  </div>
                ) : (
                  <div className="px-3 py-1 bg-slate-700/50 text-slate-400 rounded-full text-xs font-bold border border-slate-600/20">
                    All Clear
                  </div>
                )}
              </div>
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1">Support Tickets</p>
                <p className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  {stats.totalTickets}
                </p>
                {stats.openTickets > 0 && (
                  <p className="text-sm text-slate-400 mt-1">
                    <span className="text-purple-400 font-semibold">{stats.openTickets}</span> need attention
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Workflow Error Dashboard - Global Admin Only */}
        {JSON.parse(localStorage.getItem('user'))?.role === 'global_admin' && allWorkflowErrors.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-red-600/20 to-orange-600/20 rounded-lg flex items-center justify-center border border-red-500/20">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white">Workflow Errors Overview</h2>
                <p className="text-slate-400">System-wide workflow execution errors</p>
              </div>
              <div className="px-4 py-2 bg-red-500/10 text-red-400 rounded-lg border border-red-500/30 font-semibold">
                {allWorkflowErrors.length} Active {allWorkflowErrors.length === 1 ? 'Error' : 'Errors'}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {allWorkflowErrors.map(({ workflow, execution }) => (
                <div
                  key={workflow.id}
                  className="bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-xl border border-red-500/30 p-6 hover:border-red-500/50 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-red-600/40 to-orange-600/40 rounded-lg flex items-center justify-center border border-red-500/30">
                          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-semibold text-lg mb-1 truncate">
                            {workflow.name}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <span>Tenant ID: {workflow.tenant_id}</span>
                            <span>•</span>
                            <span>{new Date(execution.error.timestamp).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-3">
                        <p className="text-red-300 text-sm mb-2 font-medium">
                          {execution.error.message}
                        </p>
                        <div className="flex items-center gap-2 text-xs flex-wrap">
                          <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded border border-red-500/30">
                            Node: {execution.error.node}
                          </span>
                          <span className="px-2 py-1 bg-slate-700/50 text-slate-300 rounded border border-slate-600/30">
                            Execution ID: {execution.id}
                          </span>
                          <span className="px-2 py-1 bg-slate-700/50 text-slate-300 rounded border border-slate-600/30">
                            Workflow ID: {execution.workflowId}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          console.log('[MODAL OPEN - GLOBAL ADMIN] Opening error modal for workflow:', workflow.name);
                          console.log('[MODAL OPEN - GLOBAL ADMIN] Execution data:', execution);
                          console.log('[MODAL OPEN - GLOBAL ADMIN] Error object:', execution?.error);
                          setSelectedError({ workflow, execution });
                          setShowErrorModal(true);
                        }}
                        className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/30 hover:border-red-500/50 text-sm font-medium transition-all flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        View Full Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ticket Status Overview - Global Admin Only */}
        {ticketStats && (
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-lg flex items-center justify-center border border-purple-500/20">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white">Support Ticket Overview</h2>
                <p className="text-slate-400">System-wide ticket statistics</p>
              </div>
              <button
                onClick={() => navigate('/tickets')}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300 font-semibold"
              >
                View All Tickets
              </button>
            </div>

            {/* Status Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              {/* Open */}
              <div className="group bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-xl border border-slate-800 hover:border-green-500/50 transition-all duration-300 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <p className="text-2xl font-bold text-green-400">{ticketStats.open}</p>
                <p className="text-xs text-slate-400 font-medium">Open</p>
              </div>

              {/* In Progress */}
              <div className="group bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-xl border border-slate-800 hover:border-blue-500/50 transition-all duration-300 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <p className="text-2xl font-bold text-blue-400">{ticketStats.in_progress}</p>
                <p className="text-xs text-slate-400 font-medium">In Progress</p>
              </div>

              {/* Waiting Customer */}
              <div className="group bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-xl border border-slate-800 hover:border-orange-500/50 transition-all duration-300 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>
                <p className="text-2xl font-bold text-orange-400">{ticketStats.waiting_customer}</p>
                <p className="text-xs text-slate-400 font-medium">Waiting Customer</p>
              </div>

              {/* Waiting Internal */}
              <div className="group bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-xl border border-slate-800 hover:border-yellow-500/50 transition-all duration-300 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <p className="text-2xl font-bold text-yellow-400">{ticketStats.waiting_internal}</p>
                <p className="text-xs text-slate-400 font-medium">Waiting Internal</p>
              </div>

              {/* Resolved */}
              <div className="group bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-xl border border-slate-800 hover:border-purple-500/50 transition-all duration-300 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <p className="text-2xl font-bold text-purple-400">{ticketStats.resolved}</p>
                <p className="text-xs text-slate-400 font-medium">Resolved</p>
              </div>

              {/* Closed */}
              <div className="group bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-xl border border-slate-800 hover:border-slate-500/50 transition-all duration-300 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-slate-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-400">{ticketStats.closed}</p>
                <p className="text-xs text-slate-400 font-medium">Closed</p>
              </div>
            </div>

            {/* Priority Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Urgent */}
              <div className="bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-xl border border-slate-800 hover:border-red-500/50 transition-all duration-300 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Urgent</p>
                  </div>
                  <p className="text-2xl font-bold text-red-400">{ticketStats.urgent}</p>
                </div>
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-500"
                    style={{ width: `${ticketStats.total > 0 ? (ticketStats.urgent / ticketStats.total * 100) : 0}%` }}
                  ></div>
                </div>
              </div>

              {/* High */}
              <div className="bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-xl border border-slate-800 hover:border-orange-500/50 transition-all duration-300 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">High</p>
                  </div>
                  <p className="text-2xl font-bold text-orange-400">{ticketStats.high}</p>
                </div>
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-orange-600 transition-all duration-500"
                    style={{ width: `${ticketStats.total > 0 ? (ticketStats.high / ticketStats.total * 100) : 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Medium */}
              <div className="bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-xl border border-slate-800 hover:border-yellow-500/50 transition-all duration-300 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Medium</p>
                  </div>
                  <p className="text-2xl font-bold text-yellow-400">{ticketStats.medium}</p>
                </div>
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-500 to-yellow-600 transition-all duration-500"
                    style={{ width: `${ticketStats.total > 0 ? (ticketStats.medium / ticketStats.total * 100) : 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Low */}
              <div className="bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-xl border border-slate-800 hover:border-blue-500/50 transition-all duration-300 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Low</p>
                  </div>
                  <p className="text-2xl font-bold text-blue-400">{ticketStats.low}</p>
                </div>
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                    style={{ width: `${ticketStats.total > 0 ? (ticketStats.low / ticketStats.total * 100) : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions Section */}
        <div className="bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-2xl border border-slate-800 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-theme-primary-dark/20 to-theme-secondary-dark/20 rounded-lg flex items-center justify-center border border-theme-primary/20">
              <svg className="w-5 h-5 text-theme-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white">Quick Actions</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Manage Users Button */}
            <button
              onClick={() => window.location.href = '/users'}
              className="group relative bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-800 hover:border-theme-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-theme-primary/10 hover:-translate-y-1 overflow-hidden p-6"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/0 to-pink-600/0 group-hover:from-theme-primary-dark/10 group-hover:to-theme-secondary-dark/10 transition-all duration-300"></div>
              <div className="relative flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-theme-primary-dark/20 to-theme-secondary-dark/20 rounded-xl flex items-center justify-center border border-theme-primary/20 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-theme-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-white text-lg mb-1 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-theme-accent group-hover:to-theme-accent-alt group-hover:bg-clip-text transition-all">
                    Manage Users
                  </p>
                  <p className="text-slate-400 text-sm">Add, edit, and manage user accounts</p>
                </div>
                <svg className="w-5 h-5 text-slate-600 group-hover:text-theme-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            {/* Manage Tenants Button */}
            <button
              onClick={() => window.location.href = '/tenants'}
              className="group relative bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-800 hover:border-blue-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 overflow-hidden p-6"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/0 to-cyan-600/0 group-hover:from-blue-600/10 group-hover:to-cyan-600/10 transition-all duration-300"></div>
              <div className="relative flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 rounded-xl flex items-center justify-center border border-blue-500/20 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-white text-lg mb-1 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-400 group-hover:to-cyan-400 group-hover:bg-clip-text transition-all">
                    Manage Tenants
                  </p>
                  <p className="text-slate-400 text-sm">Configure tenant settings and access</p>
                </div>
                <svg className="w-5 h-5 text-slate-600 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            {/* Settings Button */}
            <button
              onClick={() => window.location.href = '/settings'}
              className="group relative bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-800 hover:border-slate-600 transition-all duration-300 hover:shadow-xl hover:shadow-slate-500/10 hover:-translate-y-1 overflow-hidden p-6"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-slate-700/0 to-slate-800/0 group-hover:from-slate-700/10 group-hover:to-slate-800/10 transition-all duration-300"></div>
              <div className="relative flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-slate-700/20 to-slate-800/20 rounded-xl flex items-center justify-center border border-slate-600/20 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-white text-lg mb-1 group-hover:text-slate-300 transition-all">
                    Settings
                  </p>
                  <p className="text-slate-400 text-sm">Configure system preferences</p>
                </div>
                <svg className="w-5 h-5 text-slate-600 group-hover:text-slate-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          </div>
        </div>

        {/* Workflow Heartbeat Monitor */}
        {workflows.length > 0 && (
          <div className="mt-8 bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-2xl border border-slate-800 p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-600/20 to-teal-600/20 rounded-lg flex items-center justify-center border border-emerald-500/20">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white">Workflow Monitor</h2>
              </div>
              <button
                onClick={() => fetchStats()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>

            <div className="space-y-4">
              {workflows.map(workflow => {
                const timing = workflowTimings[workflow.id] || { elapsedTime: 0, startTime: null };
                const execution = workflowExecutions[workflow.id];
                const hasError = execution?.status === 'error';
                const isActive = workflow.active;
                const elapsed = timing.elapsedTime;
                const seconds = Math.floor(elapsed / 1000);
                const minutes = Math.floor(seconds / 60);
                const hours = Math.floor(minutes / 60);

                const displayTime = hours > 0
                  ? `${hours}h ${minutes % 60}m ${seconds % 60}s`
                  : minutes > 0
                  ? `${minutes}m ${seconds % 60}s`
                  : `${seconds}s`;

                return (
                  <div
                    key={workflow.id}
                    className={`relative bg-slate-900/50 rounded-xl border p-5 hover:border-slate-700 transition-all group ${
                      hasError ? 'border-red-500/50' : 'border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        {/* Status Indicator with Heartbeat Animation */}
                        <div className="relative">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 ${
                            hasError
                              ? 'bg-red-500/20 border-red-500/50'
                              : isActive
                              ? 'bg-emerald-500/20 border-emerald-500/50'
                              : 'bg-slate-700/20 border-slate-600/50'
                          }`}>
                            {hasError ? (
                              <div className="relative">
                                <svg className="w-6 h-6 text-red-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping"></div>
                              </div>
                            ) : isActive ? (
                              <div className="relative">
                                <svg className="w-6 h-6 text-emerald-400 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                </svg>
                                <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping"></div>
                              </div>
                            ) : (
                              <div className="relative">
                                <svg className="w-6 h-6 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Workflow Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-semibold text-lg mb-1 truncate" title={workflow.name}>
                            {workflow.name.length > 63 ? `${workflow.name.substring(0, 63)}...` : workflow.name}
                          </h3>
                          <div className="flex items-center gap-3 text-sm flex-wrap">
                            <span className={`px-2.5 py-1 rounded-lg font-medium ${
                              isActive
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-700/20 text-slate-400 border border-slate-600/30'
                            }`}>
                              {isActive ? 'Running' : 'Stopped'}
                            </span>
                            {hasError && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  console.log('[MODAL OPEN] Opening error modal for workflow:', workflow.name);
                                  console.log('[MODAL OPEN] Execution data:', execution);
                                  console.log('[MODAL OPEN] Error object:', execution?.error);
                                  setSelectedError({ workflow, execution });
                                  setShowErrorModal(true);
                                }}
                                className="px-2.5 py-1 rounded-lg font-medium bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 hover:border-red-500/50 flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Error Detected
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </button>
                            )}
                            {isActive && timing.startTime && (
                              <>
                                <span className="text-slate-400">
                                  Started: <span className="text-white font-medium">{new Date(timing.startTime).toLocaleString()}</span>
                                </span>
                                <span className="text-slate-500">•</span>
                                <span className="text-slate-400">
                                  Running for <span className="text-white font-mono">{displayTime}</span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Heartbeat Visualization */}
                        <div className="hidden lg:flex items-center gap-2 px-4">
                          <div className="relative h-16 w-48 bg-slate-950/50 rounded-lg border border-slate-800 overflow-hidden">
                            {isActive ? (
                              <svg className="w-full h-full" viewBox="0 0 200 60" preserveAspectRatio="none">
                                <defs>
                                  <linearGradient id={`gradient-${workflow.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="rgb(52, 211, 153)" stopOpacity="0.8" />
                                    <stop offset="100%" stopColor="rgb(52, 211, 153)" stopOpacity="0.1" />
                                  </linearGradient>
                                </defs>
                                {/* Rolling heartbeat pattern - repeating pattern */}
                                <g>
                                  {/* First heartbeat pattern */}
                                  <path
                                    d="M-50,30 L-30,30 L-25,15 L-20,45 L-15,20 L-10,30 L10,30 L15,15 L20,45 L25,20 L30,30 L50,30 L55,15 L60,45 L65,20 L70,30 L90,30 L95,15 L100,45 L105,20 L110,30 L130,30 L135,15 L140,45 L145,20 L150,30 L170,30 L175,15 L180,45 L185,20 L190,30 L210,30 L215,15 L220,45 L225,20 L230,30 L250,30"
                                    fill="none"
                                    stroke="rgb(52, 211, 153)"
                                    strokeWidth="2"
                                    opacity="0.6"
                                  >
                                    <animateTransform
                                      attributeName="transform"
                                      type="translate"
                                      from="0 0"
                                      to="-80 0"
                                      dur="2s"
                                      repeatCount="indefinite"
                                    />
                                  </path>
                                  {/* Fill gradient under heartbeat */}
                                  <path
                                    d="M-50,30 L-30,30 L-25,15 L-20,45 L-15,20 L-10,30 L10,30 L15,15 L20,45 L25,20 L30,30 L50,30 L55,15 L60,45 L65,20 L70,30 L90,30 L95,15 L100,45 L105,20 L110,30 L130,30 L135,15 L140,45 L145,20 L150,30 L170,30 L175,15 L180,45 L185,20 L190,30 L210,30 L215,15 L220,45 L225,20 L230,30 L250,30 L250,60 L-50,60 Z"
                                    fill={`url(#gradient-${workflow.id})`}
                                    opacity="0.3"
                                  >
                                    <animateTransform
                                      attributeName="transform"
                                      type="translate"
                                      from="0 0"
                                      to="-80 0"
                                      dur="2s"
                                      repeatCount="indefinite"
                                    />
                                  </path>
                                </g>
                              </svg>
                            ) : (
                              <svg className="w-full h-full" viewBox="0 0 200 60" preserveAspectRatio="none">
                                <defs>
                                  <linearGradient id={`gradient-red-${workflow.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="rgb(248, 113, 113)" stopOpacity="0.6" />
                                    <stop offset="100%" stopColor="rgb(248, 113, 113)" stopOpacity="0.1" />
                                  </linearGradient>
                                </defs>
                                <line
                                  x1="0"
                                  y1="30"
                                  x2="200"
                                  y2="30"
                                  stroke="rgb(248, 113, 113)"
                                  strokeWidth="2"
                                  opacity="0.5"
                                />
                                {/* Small blip/spike to indicate stopped state */}
                                <path
                                  d="M80,30 L85,30 L87,25 L89,35 L91,30 L200,30"
                                  fill="none"
                                  stroke="rgb(248, 113, 113)"
                                  strokeWidth="2"
                                  opacity="0.4"
                                />
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <button
                        onClick={() => navigate('/automations')}
                        className="ml-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2 opacity-0 group-hover:opacity-100"
                      >
                        View
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>

                    {/* Error Display */}
                    {hasError && execution?.error && (
                      <div className="mt-4 pt-4 border-t border-red-500/30">
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                              <svg className="w-5 h-5 text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-red-400 font-semibold text-sm">Execution Error</h4>
                                <span className="text-xs text-red-400/70">
                                  {new Date(execution.error.timestamp).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-red-300/90 text-sm mb-2">
                                {execution.error.message}
                              </p>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded border border-red-500/30">
                                  Node: {execution.error.node}
                                </span>
                                <span className="px-2 py-1 bg-slate-700/50 text-slate-300 rounded border border-slate-600/30">
                                  Execution ID: {execution.id}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {workflows.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-slate-700/20 to-slate-800/20 rounded-2xl flex items-center justify-center border border-slate-700">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No Workflows Yet</h3>
                <p className="text-slate-400 mb-4">Create your first automation to see it here</p>
                <button
                  onClick={() => navigate('/automations')}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/30"
                >
                  Browse Automations
                </button>
              </div>
            )}
          </div>
        )}

        {/* Activity Feed Section (Optional - Placeholder) */}
        <div className="mt-8 bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-2xl border border-slate-800 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-theme-primary-dark/20 to-theme-secondary-dark/20 rounded-lg flex items-center justify-center border border-theme-primary/20">
              <svg className="w-5 h-5 text-theme-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white">Recent Activity</h2>
          </div>

          {recentActivity.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.map((activity, index) => {
                const startTime = new Date(activity.execution.startedAt);
                const endTime = new Date(activity.execution.stoppedAt || activity.execution.startedAt);
                const durationMs = endTime - startTime;
                const durationMinutes = Math.floor(durationMs / 1000 / 60);
                const durationSeconds = Math.floor((durationMs / 1000) % 60);

                const statusColors = {
                  'success': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
                  'running': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                  'error': 'bg-red-500/20 text-red-400 border-red-500/30',
                  'waiting': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                };

                const statusIcons = {
                  'success': (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                  'running': (
                    <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ),
                  'error': (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                  'waiting': (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )
                };

                return (
                  <div key={`${activity.workflow.id}-${activity.execution.id}`} className="bg-slate-800/30 hover:bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${statusColors[activity.execution.status] || statusColors.waiting}`}>
                          {statusIcons[activity.execution.status] || statusIcons.waiting}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white truncate">{activity.workflow.name}</h3>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-slate-400">
                            <div className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>Started: {startTime.toLocaleTimeString()}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Ended: {endTime.toLocaleTimeString()}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              <span className="font-medium text-emerald-400">
                                {durationMinutes > 0 ? `${durationMinutes}m ${durationSeconds}s` : `${durationSeconds}s`}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-lg text-xs font-medium border whitespace-nowrap ${statusColors[activity.execution.status] || statusColors.waiting}`}>
                        {activity.execution.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-theme-primary-dark/10 to-theme-secondary-dark/10 rounded-2xl flex items-center justify-center border border-theme-primary/20">
                <svg className="w-8 h-8 text-theme-accent/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-slate-400">No recent workflow activity</p>
            </div>
          )}
        </div>
      </div>

      {/* Error Details Modal */}
      {showErrorModal && selectedError && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-red-500/30 max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl shadow-red-500/20">
            {/* Modal Header */}
            <div className="relative p-8 border-b border-red-500/30 bg-gradient-to-r from-red-600/10 to-orange-600/10">
              <div className="absolute inset-0 bg-gradient-to-r from-red-600/5 to-orange-600/5" />
              <div className="relative flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-red-600/40 to-orange-600/40 rounded-2xl flex items-center justify-center border border-red-500/30 shadow-lg shadow-red-500/20">
                    <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1">Workflow Execution Error</h2>
                    <p className="text-red-300/80 text-sm">{selectedError.workflow.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowErrorModal(false);
                    setSelectedError(null);
                  }}
                  className="text-slate-400 hover:text-white transition-colors p-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-8 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {/* Execution Info */}
              <div className="bg-slate-900/50 rounded-xl border border-slate-700 p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Execution Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Execution ID</p>
                    <p className="text-white font-mono text-sm">{selectedError.execution.id}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Workflow ID</p>
                    <p className="text-white font-mono text-sm">{selectedError.execution.workflowId}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Status</p>
                    <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium border border-red-500/30 inline-block">
                      {selectedError.execution.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Mode</p>
                    <p className="text-white text-sm">{selectedError.execution.mode || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Started At</p>
                    <p className="text-white text-sm">{new Date(selectedError.execution.startedAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Stopped At</p>
                    <p className="text-white text-sm">
                      {selectedError.execution.stoppedAt
                        ? new Date(selectedError.execution.stoppedAt).toLocaleString()
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Error Details */}
              {selectedError.execution.error && (
                <div className="bg-red-500/10 rounded-xl border border-red-500/30 p-6">
                  <h3 className="text-red-400 font-semibold mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Error Details
                  </h3>

                  <div className="space-y-4">
                    {/* Error Type */}
                    {selectedError.execution.error.type && (
                      <div>
                        <p className="text-red-300/70 text-sm mb-2">Error Type</p>
                        <div className="bg-slate-900/50 rounded-lg px-4 py-2 border border-red-500/20">
                          <p className="text-red-200 font-medium text-sm">
                            {selectedError.execution.error.type}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Error Message */}
                    <div>
                      <p className="text-red-300/70 text-sm mb-2">Error Message</p>
                      <div className="bg-slate-900/50 rounded-lg p-4 border border-red-500/20">
                        <p className="text-red-200 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                          {selectedError.execution.error.message}
                        </p>
                      </div>
                    </div>

                    {/* Error Description */}
                    {selectedError.execution.error.description && (
                      <div>
                        <p className="text-red-300/70 text-sm mb-2">Description</p>
                        <div className="bg-slate-900/50 rounded-lg p-4 border border-red-500/20">
                          <p className="text-red-200 text-sm leading-relaxed">
                            {selectedError.execution.error.description}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Error Context */}
                    {selectedError.execution.error.context && (
                      <div>
                        <p className="text-red-300/70 text-sm mb-2">Error Context</p>
                        <div className="bg-slate-900/50 rounded-lg p-4 border border-red-500/20">
                          <p className="text-red-200 text-sm leading-relaxed font-mono whitespace-pre-wrap">
                            {typeof selectedError.execution.error.context === 'string'
                              ? selectedError.execution.error.context
                              : JSON.stringify(selectedError.execution.error.context, null, 2)}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-red-300/70 text-sm mb-2">Failed Node</p>
                        <div className="bg-slate-900/50 rounded-lg px-4 py-2 border border-red-500/20">
                          <p className="text-red-200 font-medium text-sm">
                            {selectedError.execution.error.node}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-red-300/70 text-sm mb-2">Error Timestamp</p>
                        <div className="bg-slate-900/50 rounded-lg px-4 py-2 border border-red-500/20">
                          <p className="text-red-200 text-sm">
                            {new Date(selectedError.execution.error.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Last Node Executed */}
                    {selectedError.execution.error.lastNodeExecuted && (
                      <div>
                        <p className="text-red-300/70 text-sm mb-2">Last Node Executed</p>
                        <div className="bg-slate-900/50 rounded-lg px-4 py-2 border border-red-500/20">
                          <p className="text-red-200 text-sm">
                            {selectedError.execution.error.lastNodeExecuted}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Stack Trace */}
                    {selectedError.execution.error.stack && (
                      <div>
                        <p className="text-red-300/70 text-sm mb-2">Stack Trace (First 5 lines)</p>
                        <div className="bg-slate-900/50 rounded-lg p-4 border border-red-500/20 overflow-x-auto">
                          <pre className="text-red-200 font-mono text-xs leading-relaxed">
                            {selectedError.execution.error.stack}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Workflow Info */}
              <div className="bg-slate-900/50 rounded-xl border border-slate-700 p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Workflow Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Workflow Name</p>
                    <p className="text-white text-sm">{selectedError.workflow.name}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Workflow ID</p>
                    <p className="text-white font-mono text-sm">{selectedError.workflow.id}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Tenant ID</p>
                    <p className="text-white font-mono text-sm">{selectedError.workflow.tenant_id}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Active Status</p>
                    <span className={`px-3 py-1 rounded-lg text-sm font-medium inline-block ${
                      selectedError.workflow.active
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-700/50 text-slate-400 border border-slate-600/30'
                    }`}>
                      {selectedError.workflow.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-800 bg-slate-950/80 flex justify-between items-center">
              <div className="text-sm text-slate-400">
                Use this information to debug and resolve the workflow error
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/automations')}
                  className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/30 hover:border-blue-500/50 text-sm font-medium transition-all"
                >
                  Go to Workflows
                </button>
                <button
                  onClick={() => {
                    setShowErrorModal(false);
                    setSelectedError(null);
                  }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
