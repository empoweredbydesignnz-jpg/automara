import React, { useState, useEffect } from 'react';
import axios from 'axios';

function ReportingPage() {
  const [workflows, setWorkflows] = useState([]);
  const [workflowHistory, setWorkflowHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    fetchWorkflows();
  }, []);

  useEffect(() => {
    if (workflows.length > 0) {
      fetchWorkflowExecutionHistory();

      // Set up auto-refresh every 60 seconds
      const refreshInterval = setInterval(() => {
        fetchWorkflowExecutionHistory();
      }, 60000); // 60 seconds

      // Cleanup interval on unmount
      return () => clearInterval(refreshInterval);
    }
  }, [workflows]);

  const fetchWorkflows = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user'));

      if (user?.tenantId) {
        try {
          const workflowsResponse = await axios.get('/api/workflows', {
            headers: {
              'x-user-role': user?.role || 'client_user',
              'x-tenant-id': user?.tenantId || ''
            }
          });
          const workflowsData = workflowsResponse.data.workflows || [];
          setWorkflows(workflowsData);
        } catch (err) {
          console.error('Error fetching workflows:', err);
        }
      }
    } catch (error) {
      console.error('Error fetching workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch real execution data for all workflows
  const fetchWorkflowExecutionHistory = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      const history = [];

      const colors = [
        { name: 'Color 1', color: '#34d399', lightColor: '#6ee7b7' },
        { name: 'Color 2', color: '#60a5fa', lightColor: '#93c5fd' },
        { name: 'Color 3', color: '#f472b6', lightColor: '#f9a8d4' },
        { name: 'Color 4', color: '#fbbf24', lightColor: '#fcd34d' },
        { name: 'Color 5', color: '#a78bfa', lightColor: '#c4b5fd' },
        { name: 'Color 6', color: '#fb923c', lightColor: '#fdba74' },
        { name: 'Color 7', color: '#22d3ee', lightColor: '#67e8f9' },
        { name: 'Color 8', color: '#f87171', lightColor: '#fca5a5' },
      ];

      // Generate data structure for last 14 days
      for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
        const date = new Date();
        date.setDate(date.getDate() - dayOffset);
        date.setHours(0, 0, 0, 0);

        const dayData = {
          date: date.toISOString().split('T')[0],
          workflows: []
        };
        history.push(dayData);
      }

      // Fetch execution data for each workflow
      for (let index = 0; index < workflows.length; index++) {
        const workflow = workflows[index];

        try {
          // Fetch executions for this workflow
          const response = await axios.get(`/api/workflows/${workflow.id}/executions`, {
            params: { limit: 100 },
            headers: {
              'x-user-role': user?.role || 'client_user',
              'x-tenant-id': user?.tenantId || '',
              'x-user-id': user?.id || ''
            }
          });

          if (response.data.success && response.data.executions.length > 0) {
            const executions = response.data.executions;

            // Group executions by day
            executions.forEach(execution => {
              const executionDate = new Date(execution.startedAt);
              const dayKey = executionDate.toISOString().split('T')[0];

              // Find the corresponding day in history
              const dayData = history.find(d => d.date === dayKey);

              if (dayData) {
                const startTime = new Date(execution.startedAt).getTime();
                const endTime = new Date(execution.stoppedAt || execution.startedAt).getTime();
                const durationMinutes = Math.max(1, Math.floor((endTime - startTime) / 1000 / 60));

                dayData.workflows.push({
                  workflowId: workflow.id,
                  workflowName: workflow.name,
                  color: colors[index % colors.length].color,
                  lightColor: colors[index % colors.length].lightColor,
                  startTime: startTime,
                  endTime: endTime,
                  duration: durationMinutes,
                  status: execution.status,
                  executionId: execution.id
                });
              }
            });
          }
        } catch (error) {
          console.error(`Error fetching executions for workflow ${workflow.id}:`, error);
        }
      }

      // Sort workflows within each day by start time
      history.forEach(day => {
        day.workflows.sort((a, b) => a.startTime - b.startTime);
      });

      setWorkflowHistory(history);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching workflow execution history:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-theme-primary/30 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-theme-primary rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-400 text-lg font-medium">Loading reports...</p>
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
            Reporting
          </h1>
          <p className="text-slate-400 text-lg">
            Workflow runtime analytics and performance metrics
          </p>
        </div>

        {/* Workflow Runtime Chart - 14 Days */}
        {workflows.length > 0 && workflowHistory.length > 0 && (
          <div className="bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-2xl border border-slate-800 p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-lg flex items-center justify-center border border-purple-500/20">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Workflow Runtime History</h2>
                  <p className="text-slate-400 text-sm mt-1">Last 14 days - Candlestick view</p>
                </div>
              </div>
              {lastUpdated && (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <svg className="w-4 h-4 animate-pulse text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Auto-refresh: 60s | Last updated: {lastUpdated.toLocaleTimeString()}</span>
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mb-6 pb-4 border-b border-slate-800">
              {workflows.map((workflow, index) => {
                const colors = [
                  { bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500' },
                  { bg: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500' },
                  { bg: 'bg-pink-500', text: 'text-pink-400', border: 'border-pink-500' },
                  { bg: 'bg-yellow-500', text: 'text-yellow-400', border: 'border-yellow-500' },
                  { bg: 'bg-purple-500', text: 'text-purple-400', border: 'border-purple-500' },
                ];
                const color = colors[index % colors.length];
                return (
                  <div key={workflow.id} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-sm ${color.bg}`}></div>
                    <span className={`text-sm font-medium ${color.text}`}>{workflow.name}</span>
                  </div>
                );
              })}
            </div>

            {/* Candlestick Chart */}
            <div className="relative">
              <div className="flex gap-1 items-end justify-between h-96 px-4">
                {workflowHistory.map((day, dayIndex) => {
                  const maxDuration = Math.max(...workflowHistory.flatMap(d => d.workflows.map(w => w.duration)));

                  return (
                    <div key={dayIndex} className="flex-1 flex flex-col items-center gap-1 group relative">
                      {/* Date label */}
                      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs text-slate-500 whitespace-nowrap rotate-45 origin-top-left">
                        {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>

                      {/* Candlesticks container */}
                      <div className="flex-1 w-full flex flex-col justify-end items-center gap-0.5 relative">
                        {day.workflows.map((session, sessionIndex) => {
                          const heightPercent = (session.duration / maxDuration) * 100;
                          const startHour = new Date(session.startTime).getHours();
                          const endHour = new Date(session.endTime).getHours();

                          return (
                            <div
                              key={sessionIndex}
                              className="relative transition-all duration-200 hover:opacity-100 cursor-pointer"
                              style={{
                                width: '100%',
                                height: `${Math.max(heightPercent, 2)}%`,
                                maxHeight: '100%',
                                backgroundColor: session.color,
                                opacity: 0.8,
                                borderRadius: '2px',
                                boxShadow: `0 0 10px ${session.color}40`
                              }}
                              onMouseEnter={(e) => {
                                const tooltip = e.currentTarget.querySelector('.tooltip');
                                if (tooltip) tooltip.style.display = 'block';
                              }}
                              onMouseLeave={(e) => {
                                const tooltip = e.currentTarget.querySelector('.tooltip');
                                if (tooltip) tooltip.style.display = 'none';
                              }}
                            >
                              {/* Wick lines for start and end times */}
                              <div
                                className="absolute left-1/2 transform -translate-x-1/2 w-0.5"
                                style={{
                                  top: '-4px',
                                  height: '4px',
                                  backgroundColor: session.lightColor,
                                  opacity: 0.6
                                }}
                              ></div>
                              <div
                                className="absolute left-1/2 transform -translate-x-1/2 w-0.5"
                                style={{
                                  bottom: '-4px',
                                  height: '4px',
                                  backgroundColor: session.lightColor,
                                  opacity: 0.6
                                }}
                              ></div>

                              {/* Tooltip */}
                              <div
                                className="tooltip absolute z-50 bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs whitespace-nowrap pointer-events-none shadow-xl"
                                style={{
                                  display: 'none',
                                  left: '50%',
                                  transform: 'translateX(-50%)',
                                  bottom: '100%',
                                  marginBottom: '8px'
                                }}
                              >
                                <div className="font-semibold text-white mb-1">{session.workflowName}</div>
                                <div className="text-slate-400">
                                  Started: {new Date(session.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                <div className="text-slate-400">
                                  Stopped: {new Date(session.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                <div className="text-emerald-400 font-semibold mt-1">
                                  Duration: {Math.floor(session.duration / 60)}h {session.duration % 60}m
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Hover effect on entire day column */}
                      <div className="absolute inset-0 bg-slate-700/0 group-hover:bg-slate-700/10 transition-all pointer-events-none rounded"></div>
                    </div>
                  );
                })}
              </div>

              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 h-96 flex flex-col justify-between text-xs text-slate-500 pr-2">
                <span>Max</span>
                <span>75%</span>
                <span>50%</span>
                <span>25%</span>
                <span>0h</span>
              </div>
            </div>

            <div className="mt-12 text-center text-xs text-slate-500">
              Hover over bars to see detailed runtime information
            </div>
          </div>
        )}

        {/* No Workflows State */}
        {workflows.length === 0 && (
          <div className="bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-2xl border border-slate-800 p-12">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-2xl flex items-center justify-center border border-purple-500/20">
                <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">No Workflow Data Available</h3>
              <p className="text-slate-400 mb-6 max-w-md mx-auto">
                Create and activate workflows to see runtime analytics and performance metrics here.
              </p>
              <a
                href="/automations"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/30"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Browse Automations
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReportingPage;
