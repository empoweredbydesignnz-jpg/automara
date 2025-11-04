import React, { useState, useEffect } from 'react'
import axios from 'axios'

function TenantsPage() {
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTenant, setNewTenant] = useState({
    name: '',
    domain: '',
    owner_email: ''
  })

  useEffect(() => {
    fetchTenants()
  }, [])

  const fetchTenants = async () => {
    try {
      const response = await axios.get('/api/tenants')
      setTenants(response.data.tenants || [])
    } catch (error) {
      console.error('Error fetching tenants:', error)
      setTenants([
        { id: 1, name: 'Acme Corp', domain: 'acme.automara.com', owner_email: 'admin@acme.com', status: 'active', created_at: '2025-01-15' },
        { id: 2, name: 'TechStart Inc', domain: 'techstart.automara.com', owner_email: 'owner@techstart.com', status: 'active', created_at: '2025-02-20' },
        { id: 3, name: 'Global Solutions', domain: 'global.automara.com', owner_email: 'contact@global.com', status: 'active', created_at: '2025-03-10' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleAddTenant = async (e) => {
    e.preventDefault()
    try {
      await axios.post('/api/tenants', newTenant)
      setShowAddModal(false)
      setNewTenant({ name: '', domain: '', owner_email: '' })
      fetchTenants()
    } catch (error) {
      console.error('Error adding tenant:', error)
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Tenants</h1>
          <p className="text-gray-400">Manage your multi-tenant organizations</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-purple-700 hover:to-pink-700 transition flex items-center space-x-2"
        >
          <span>+</span>
          <span>Add Tenant</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tenants.map((tenant) => (
            <div
              key={tenant.id}
              className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-purple-500 transition group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                  {tenant.name.charAt(0)}
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500 bg-opacity-10 text-green-400 border border-green-500">
                  {tenant.status}
                </span>
              </div>

              <h3 className="text-xl font-bold text-white mb-2">{tenant.name}</h3>
              <p className="text-purple-400 text-sm mb-4">{tenant.domain}</p>
              
              <div className="space-y-2 text-sm text-gray-400 mb-4">
                <div className="flex items-center space-x-2">
                  <span>📧</span>
                  <span>{tenant.owner_email}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span>📅</span>
                  <span>Created {new Date(tenant.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex space-x-2">
                <button className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition text-sm font-medium">
                  Manage
                </button>
                <button className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition text-sm font-medium">
                  Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-6">Add New Tenant</h2>
            
            <form onSubmit={handleAddTenant} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tenant Name
                </label>
                <input
                  type="text"
                  value={newTenant.name}
                  onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                  placeholder="Acme Corporation"
                  required
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Domain
                </label>
                <input
                  type="text"
                  value={newTenant.domain}
                  onChange={(e) => setNewTenant({ ...newTenant, domain: e.target.value })}
                  placeholder="acme.automara.com"
                  required
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Owner Email
                </label>
                <input
                  type="email"
                  value={newTenant.owner_email}
                  onChange={(e) => setNewTenant({ ...newTenant, owner_email: e.target.value })}
                  placeholder="admin@acme.com"
                  required
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-lg transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3 px-4 rounded-lg transition font-medium"
                >
                  Add Tenant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default TenantsPage
