// frontend/src/components/ProtectedRoute.jsx
// Route guard for authenticated routes

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSessionContext } from 'supertokens-auth-react/recipe/session';

const ProtectedRoute = ({ children }) => {
  const session = useSessionContext();
  
  if (session.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!session.doesSessionExist) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

export default ProtectedRoute;


// frontend/src/pages/Dashboard.jsx
// Main dashboard with overview and quick actions

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  PlayIcon, 
  PauseIcon, 
  PlusIcon,
  ActivityIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon
} from 'lucide-react';
import api from '../utils/api';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [workflows, setWorkflows] = useState([]);
  const [recentExecutions, setRecentExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchDashboardData();
  }, []);
  
  const fetchDashboardData = async () => {
    try {
      const [statsRes, workflowsRes] = await Promise.all([
        api.get('/tenants/usage'),
        api.get('/workflows'),
      ]);
      
      setStats(statsRes.data.usage);
      setWorkflows(workflowsRes.data.workflows.slice(0, 5));
      
      // Fetch recent executions for first workflow
      if (workflowsRes.data.workflows.length > 0) {
        const execRes = await api.get(
          `/workflows/${workflowsRes.data.workflows[0].id}/executions?limit=5`
        );
        setRecentExecutions(execRes.data.executions);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  const statCards = [
    { 
      name: 'Active Workflows', 
      value: stats?.workflows || 0, 
      icon: ActivityIcon,
      color: 'blue' 
    },
    { 
      name: 'Executions (30d)', 
      value: stats?.executions_30d || 0, 
      icon: PlayIcon,
      color: 'green' 
    },
    { 
      name: 'API Keys', 
      value: stats?.active_api_keys || 0, 
      icon: CheckCircleIcon,
      color: 'purple' 
    },
  ];
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Welcome back! Here's what's happening with your workflows.
          </p>
        </div>
        <Link
          to="/workflows"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          New Workflow
        </Link>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.name}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className={`p-3 bg-${stat.color}-100 rounded-lg`}>
                  <Icon className={`w-6 h-6 text-${stat.color}-600`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Recent Workflows */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Workflows</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {workflows.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <ActivityIcon className="w-12 h-12 mx-auto text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No workflows</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating your first workflow.</p>
              <Link
                to="/workflows"
                className="inline-flex items-center px-4 py-2 mt-4 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                Create Workflow
              </Link>
            </div>
          ) : (
            workflows.map((workflow) => (
              <Link
                key={workflow.id}
                to={`/workflows/${workflow.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className={`
                    w-2 h-2 rounded-full 
                    ${workflow.is_active ? 'bg-green-500' : 'bg-gray-400'}
                  `} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{workflow.name}</p>
                    <p className="text-xs text-gray-500">{workflow.workflow_type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-900">{workflow.execution_count} runs</p>
                  <p className="text-xs text-gray-500">
                    {workflow.last_executed 
                      ? new Date(workflow.last_executed).toLocaleDateString()
                      : 'Never'
                    }
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
      
      {/* Recent Executions */}
      {recentExecutions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Executions</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {recentExecutions.map((execution) => (
              <div key={execution.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center space-x-4">
                  {execution.status === 'success' ? (
                    <CheckCircleIcon className="w-5 h-5 text-green-600" />
                  ) : execution.status === 'error' ? (
                    <XCircleIcon className="w-5 h-5 text-red-600" />
                  ) : (
                    <ClockIcon className="w-5 h-5 text-yellow-600" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {execution.status}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(execution.started_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                {execution.error_message && (
                  <p className="text-xs text-red-600 max-w-md truncate">
                    {execution.error_message}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
