import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

function Layout({ children, user, currentTenant, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()

  const navigation = [
    { name: 'Dashboard', path: '/dashboard', icon: '📊' },
    { name: 'Tenants', path: '/tenants', icon: '🏢' },
    { name: 'Settings', path: '/settings', icon: '⚙️' },
  ]

  const isActive = (path) => location.pathname === path

  return (
    <div className="min-h-screen bg-gray-900 flex">
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-gray-800 border-r border-gray-700 transition-all duration-300 flex flex-col`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-700">
          {sidebarOpen && (
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-lg">⚡</span>
              </div>
              <span className="text-white font-bold text-xl">Automara</span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-400 hover:text-white transition p-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {sidebarOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              )}
            </svg>
          </button>
        </div>

        <div className="p-4 border-b border-gray-700">
          <div className="w-full bg-gray-900 hover:bg-gray-700 text-white rounded-lg p-3 flex items-center justify-between transition">
            {sidebarOpen ? (
              <>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-sm font-bold">
                    {currentTenant?.name?.charAt(0).toUpperCase() || 'T'}
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium">{currentTenant?.name || 'Select Tenant'}</div>
                    <div className="text-xs text-gray-400">{currentTenant?.domain}</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-sm font-bold mx-auto">
                {currentTenant?.name?.charAt(0).toUpperCase() || 'T'}
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navigation.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                isActive(item.path)
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              {sidebarOpen && <span className="font-medium">{item.name}</span>}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            {sidebarOpen && (
              <div className="flex-1">
                <div className="text-sm font-medium text-white">{user?.name}</div>
                <div className="text-xs text-gray-400">{user?.role}</div>
              </div>
            )}
            {sidebarOpen && (
              <button
                onClick={onLogout}
                className="text-gray-400 hover:text-white transition"
                title="Logout"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}

export default Layout
