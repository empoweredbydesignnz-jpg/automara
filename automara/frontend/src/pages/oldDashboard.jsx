import React, { useState, useEffect } from 'react'
import axios from 'axios'

function Dashboard({ tenant }) {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTenants: 0,
    activeWorkflows: 0,
    apiCalls: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user'))
      
      // Fetch users count
      const usersResponse = await axios.get('/api/users', {
        headers: {
          'x-user-role': user?.role || 'client_user',
          'x-tenant-id': user?.tenantId || ''
        }
      })
      const totalUsers = usersResponse.data.users?.length || 0

      // Fetch tenants count (for admin only)
      let totalTenants = 0
      if (user?.role === 'global_admin') {
        const tenantsResponse = await axios.get('/api/tenants', {
          headers: {
            'x-user-role': user?.role || 'client_user',
            'x-tenant-id': user?.tenantId || ''
          }
        })
        totalTenants = tenantsResponse.data.tenants?.length || 0
      }

      setStats({
        totalUsers,
        totalTenants,
        activeWorkflows: 0, // TODO: Connect to n8n API
        apiCalls: 0 // TODO: Add tracking
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400">
          {tenant ? `Welcome to ${tenant.name}` : 'System Overview'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm opacity-80">Total Users</span>
            <span className="text-2xl">👥</span>
          </div>
          <p className="text-3xl font-bold">{stats.totalUsers}</p>
        </div>

        {stats.totalTenants > 0 && (
          <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm opacity-80">Total Tenants</span>
              <span className="text-2xl">🏢</span>
            </div>
            <p className="text-3xl font-bold">{stats.totalTenants}</p>
          </div>
        )}

        <div className="bg-gradient-to-br from-green-600 to-teal-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm opacity-80">Active Workflows</span>
            <span className="text-2xl">⚡</span>
          </div>
          <p className="text-3xl font-bold">{stats.activeWorkflows}</p>
          <p className="text-xs opacity-80 mt-1">Coming soon</p>
        </div>

        <div className="bg-gradient-to-br from-orange-600 to-red-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm opacity-80">API Calls</span>
            <span className="text-2xl">📊</span>
          </div>
          <p className="text-3xl font-bold">{stats.apiCalls}</p>
          <p className="text-xs opacity-80 mt-1">Coming soon</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-xl font-bold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => window.location.href = '/users'}
            className="bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-lg transition flex items-center space-x-3"
          >
            <span className="text-2xl">👥</span>
            <span className="font-semibold">Manage Users</span>
          </button>
          <button
            onClick={() => window.location.href = '/tenants'}
            className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-lg transition flex items-center space-x-3"
          >
            <span className="text-2xl">🏢</span>
            <span className="font-semibold">Manage Tenants</span>
          </button>
          <button
            onClick={() => window.location.href = '/settings'}
            className="bg-gray-700 hover:bg-gray-600 text-white p-4 rounded-lg transition flex items-center space-x-3"
          >
            <span className="text-2xl">⚙️</span>
            <span className="font-semibold">Settings</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default Dashboard