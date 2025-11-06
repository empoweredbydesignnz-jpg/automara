import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'

function SubTenantsPage() {
  const { parentId } = useParams()
  const navigate = useNavigate()
  const [parentTenant, setParentTenant] = useState(null)
  const [subTenants, setSubTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newSubTenant, setNewSubTenant] = useState({
    name: '',
    domain: '',
    owner_email: ''
  })

  useEffect(() => {
    fetchData()
  }, [parentId])

  const fetchData = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user'))
      
      // Fetch all tenants
      const response = await axios.get('/api/tenants', {
        headers: {
          'x-user-role': user?.role || 'client_user',
          'x-tenant-id': user?.tenantId || ''
        }
      })
      
      const tenants = response.data.tenants || []
      console.log('All tenants:', tenants)
      
      // Find parent tenant
      const parent = tenants.find(t => t.id == parentId)
      console.log('Parent tenant:', parent)
      setParentTenant(parent)
      
      // Filter sub-tenants
      const subs = tenants.filter(t => t.parent_tenant_id == parentId)
      console.log('Sub-tenants for parent', parentId, ':', subs)
      setSubTenants(subs)
      
    } catch (error) {
      console.error('Error fetching data:', error)
      alert('Failed to load sub-tenants: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddSubTenant = async (e) => {
    e.preventDefault()
    try {
      const user = JSON.parse(localStorage.getItem('user'))
      await axios.post(`/api/tenants/${parentId}/sub-tenants`, newSubTenant, {
        headers: {
          'x-user-role': user?.role || 'client_user',
          'x-tenant-id': user?.tenantId || ''
        }
      })
      setShowAddModal(false)
      setNewSubTenant({ name: '', domain: '', owner_email: '' })
      fetchData()
      alert('Sub-tenant created successfully!')
    } catch (error) {
      console.error('Error creating sub-tenant:', error)
      alert(error.response?.data?.error || 'Failed to create sub-tenant')
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/tenants')}
          className="text-purple-400 hover:text-purple-300 mb-4 flex items-center space-x-2"
        >
          <span>←</span>
          <span>Back to Tenants</span>
        </button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Sub-Tenants of {parentTenant?.name}
            </h1>
            <p className="text-gray-400">Manage client organizations under this MSP</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-blue-700 hover:to-purple-700 transition flex items-center space-x-2"
          >
            <span>+</span>
            <span>Add Client</span>
          </button>
        </div>
      </div>

      {/* Sub-Tenants Grid */}
      {subTenants.length === 0 ? (
        <div className="text-center py-12 bg-gray-800 rounded-xl border border-gray-700">
          <div className="text-6xl mb-4">🏢</div>
          <h3 className="text-xl font-semibold text-white mb-2">No sub-tenants yet</h3>
          <p className="text-gray-400 mb-6">Create your first client organization</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-lg transition"
          >
            Add Client
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subTenants.map((tenant) => (
            <div
              key={tenant.id}
              className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-blue-500 transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                  {tenant.name.charAt(0)}
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  tenant.status === 'active' 
                    ? 'bg-green-500 bg-opacity-10 text-green-400 border border-green-500' 
                    : 'bg-red-500 bg-opacity-10 text-red-400 border border-red-500'
                }`}>
                  {tenant.status}
                </span>
              </div>

              <h3 className="text-xl font-bold text-white mb-2">{tenant.name}</h3>
              <p className="text-blue-400 text-sm mb-4">{tenant.domain}</p>
              
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
            </div>
          ))}
        </div>
      )}

      {/* Add Sub-Tenant Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-6">Add Client Tenant</h2>
            
            <form onSubmit={handleAddSubTenant} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Client Name</label>
                <input
                  type="text"
                  value={newSubTenant.name}
                  onChange={(e) => setNewSubTenant({ ...newSubTenant, name: e.target.value })}
                  placeholder="Acme Corporation"
                  required
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Domain</label>
                <input
                  type="text"
                  value={newSubTenant.domain}
                  onChange={(e) => setNewSubTenant({ ...newSubTenant, domain: e.target.value })}
                  placeholder="acme.example.com"
                  required
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Owner Email</label>
                <input
                  type="email"
                  value={newSubTenant.owner_email}
                  onChange={(e) => setNewSubTenant({ ...newSubTenant, owner_email: e.target.value })}
                  placeholder="admin@acme.com"
                  required
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 px-4 rounded-lg transition font-medium"
                >
                  Create Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default SubTenantsPage
