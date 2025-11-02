import React, { useState, useEffect } from 'react'
import axios from 'axios'

function Dashboard({ tenant }) {
  const [stats, setStats] = useState({
    totalUsers: 1247,
    activeWorkflows: 34,
    apiCalls: 45623,
    revenue: 12450
  })

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers.toLocaleString(),
      change: '+12.5%',
      positive: true,
      icon: '👥',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      title: 'Active Workflows',
      value: stats.activeWorkflows,
      change: '+8.2%',
      positive: true,
      icon: '⚡',
      color: 'from-purple-500 to-pink-500'
    },
    {
      title: 'API Calls',
      value: stats.apiCalls.toLocaleString(),
      change: '+23.1%',
      positive: true,
      icon: '📊',
      color: 'from-green-500 to-emerald-500'
    },
    {
      title: 'Revenue',
      value: `$${stats.revenue.toLocaleString()}`,
      change: '+15.3%',
      positive: true,
      icon: '💰',
      color: 'from-orange-500 to-red-500'
    }
  ]

  const recentActivity = [
    { id: 1, action: 'New user registered', user: 'john@example.com', time: '5 min ago', type: 'user' },
    { id: 2, action: 'Workflow completed', user: 'Invoice Processing', time: '12 min ago', type: 'workflow' },
    { id: 3, action: 'Payment received', user: '$299.00', time: '25 min ago', type: 'payment' },
    { id: 4, action: 'API limit reached', user: 'Integration #4', time: '1 hour ago', type: 'warning' },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400">Welcome back! Here's what's happening with {tenant?.name || 'your tenant'}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat, index) => (
          <div
            key={index}
            className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-lg flex items-center justify-center text-2xl`}>
                {stat.icon}
              </div>
              <span className={`text-sm font-semibold ${stat.positive ? 'text-green-400' : 'text-red-400'}`}>
                {stat.change}
              </span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
            <div className="text-sm text-gray-400">{stat.title}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold text-white mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center space-x-4 p-4 bg-gray-900 bg-opacity-50 rounded-lg hover:bg-opacity-70 transition"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  activity.type === 'user' ? 'bg-blue-500' :
                  activity.type === 'workflow' ? 'bg-purple-500' :
                  activity.type === 'payment' ? 'bg-green-500' :
                  'bg-yellow-500'
                }`}>
                  {activity.type === 'user' && '👤'}
                  {activity.type === 'workflow' && '⚡'}
                  {activity.type === 'payment' && '💳'}
                  {activity.type === 'warning' && '⚠️'}
                </div>
                <div className="flex-1">
                  <div className="text-white font-medium">{activity.action}</div>
                  <div className="text-sm text-gray-400">{activity.user}</div>
                </div>
                <div className="text-sm text-gray-500">{activity.time}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold text-white mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 px-4 rounded-lg hover:from-purple-700 hover:to-pink-700 transition">
              Create Workflow
            </button>
            <button className="w-full bg-gray-700 text-white font-semibold py-3 px-4 rounded-lg hover:bg-gray-600 transition">
              Add User
            </button>
            <button className="w-full bg-gray-700 text-white font-semibold py-3 px-4 rounded-lg hover:bg-gray-600 transition">
              View Reports
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-700">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">System Status</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">API</span>
                <span className="flex items-center text-green-400 text-sm">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                  Operational
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Database</span>
                <span className="flex items-center text-green-400 text-sm">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                  Operational
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
