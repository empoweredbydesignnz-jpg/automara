import React, { useState } from 'react'

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tenantDomain, setTenantDomain] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await onLogin(email, password, tenantDomain)
    
    if (!result.success) {
      setError(result.message)
    }
    
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-theme-primary-dark/20 to-gray-950 p-4 relative overflow-hidden">
      {/* Ambient glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-theme-primary/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-theme-secondary/20 rounded-full blur-3xl animate-pulse delay-1000" />

      <div className="max-w-md w-full relative z-10 animate-fade-in">
        <div className="glass-card rounded-2xl p-8 premium-shadow">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-theme-primary to-theme-secondary rounded-2xl mb-4 shadow-lg shadow-theme-primary/40 glow-primary">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gradient mb-2">Automara</h1>
            <p className="text-gray-400 tracking-wide">Multi-Tenant Automation SaaS Platform</p>
          </div>

          {error && (
            <div className="mb-6 bg-red-500 bg-opacity-10 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
           <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tenant Domain {email !== 'admin@automara.com' && '*'}
              </label>
              <input
                type="text"
                value={tenantDomain}
                onChange={(e) => setTenantDomain(e.target.value)}
                placeholder="company.automara.com"
                required={email !== 'admin@automara.com'}
                disabled={email === 'admin@automara.com'}
                className="w-full px-4 py-3 bg-gray-900 bg-opacity-50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent transition disabled:opacity-50"
              />
              {email === 'admin@automara.com' && (
                <p className="text-xs text-gray-500 mt-2">Admin account - no tenant required</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 bg-gray-900 bg-opacity-50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 bg-gray-900 bg-opacity-50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-theme-primary-dark to-theme-secondary-dark text-white font-semibold py-3.5 px-4 rounded-xl hover:from-theme-primary hover:to-theme-secondary focus:outline-none focus:ring-2 focus:ring-theme-primary focus:ring-offset-2 focus:ring-offset-gray-900 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed btn-premium shadow-lg shadow-theme-primary/30"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

         {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              Don't have an account?{' '}
              <a href="/signup" className="text-theme-accent hover:text-theme-accent/80 transition font-semibold">
                Create one now
              </a>
            </p>
          </div>
        </div>

        <p className="text-center text-gray-600 text-sm mt-8 tracking-wider">
          Empowered by Design © 2025
        </p>
      </div>
    </div>
  )
}

export default LoginPage
