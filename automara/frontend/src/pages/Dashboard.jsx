import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Dashboard({ tenant }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTenants: 0,
    activeWorkflows: 0,
    apiCalls: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

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
      if (user?.tenantId) {
        try {
          const workflowsResponse = await axios.get('/api/workflows', {
            headers: {
              'x-user-role': user?.role || 'client_user',
              'x-tenant-id': user?.tenantId || ''
            }
          });
          const workflows = workflowsResponse.data.workflows || [];
          activeWorkflows = workflows.filter(w => w.active).length;
        } catch (err) {
          console.error('Error fetching workflows:', err);
        }
      }

      setStats({
        totalUsers,
        totalTenants,
        activeWorkflows,
        apiCalls: 0 // TODO: Add tracking
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
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
            {tenant ? `Welcome to ${tenant.name}` : 'System Overview'}
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

          {/* API Calls Card */}
          <div className="group relative bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-2xl border border-slate-800 hover:border-orange-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/10 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-600/0 via-orange-600/0 to-red-600/0 group-hover:from-orange-600/10 group-hover:to-red-600/10 transition-all duration-300"></div>
            <div className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-600/20 to-red-600/20 rounded-xl flex items-center justify-center border border-orange-500/20">
                  <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="px-3 py-1 bg-amber-500/10 text-amber-400 rounded-full text-xs font-bold border border-amber-500/20">
                  Coming Soon
                </div>
              </div>
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1">API Calls</p>
                <p className="text-4xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                  {stats.apiCalls}
                </p>
              </div>
            </div>
          </div>
        </div>

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
          
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-theme-primary-dark/10 to-theme-secondary-dark/10 rounded-2xl flex items-center justify-center border border-theme-primary/20">
              <svg className="w-8 h-8 text-theme-accent/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-slate-400">Activity feed coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
