import React, { useState, useEffect } from 'react'
import axios from 'axios'

function TenantsPage() {
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showManageModal, setShowManageModal] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [saving, setSaving] = useState(false)
  const [newTenant, setNewTenant] = useState({
    name: '',
    domain: '',
    owner_email: ''
  })
  const [showSubTenantModal, setShowSubTenantModal] = useState(false)
  const [parentTenant, setParentTenant] = useState(null)
  const [newSubTenant, setNewSubTenant] = useState({
    name: '',
    domain: '',
    owner_email: ''
  })

  useEffect(() => {
    fetchTenants()
  }, [])

  const fetchTenants = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user'))
      console.log('Fetching tenants with role:', user?.role)
      
      const response = await axios.get('/api/tenants', {
        headers: {
          'x-user-role': user?.role || 'client_user',
          'x-tenant-id': user?.tenantId || ''
        }
      })
      
      console.log('Tenants response:', response.data)
      setTenants(response.data.tenants || [])
    } catch (error) {
      console.error('Error fetching tenants:', error)
      console.error('Error details:', error.response?.data)
      alert('Failed to load tenants: ' + (error.response?.data?.error || error.message))
      setTenants([])
    } finally {
      setLoading(false)
    }
  }

  const handleManage = (tenant) => {
    setSelectedTenant(tenant)
    setShowManageModal(true)
  }

  const handleAddTenant = async (e) => {
    e.preventDefault()
    try {
      const user = JSON.parse(localStorage.getItem('user'))
      await axios.post('/api/tenants', newTenant, {
        headers: {
          'x-user-role': user?.role || 'client_user',
          'x-tenant-id': user?.tenantId || ''
        }
      })
      setShowAddModal(false)
      setNewTenant({ name: '', domain: '', owner_email: '' })
      fetchTenants()
      alert('Tenant created successfully!')
    } catch (error) {
      console.error('Error adding tenant:', error)
      alert('Failed to create tenant: ' + (error.response?.data?.error || error.message))
    }
  }

  const handleUpdateTenant = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const user = JSON.parse(localStorage.getItem('user'))
      await axios.put(`/api/tenants/${selectedTenant.id}`, {
        name: selectedTenant.name,
        domain: selectedTenant.domain,
        owner_email: selectedTenant.owner_email
      }, {
        headers: {
          'x-user-role': user?.role || 'client_user',
          'x-tenant-id': user?.tenantId || ''
        }
      })
      setShowManageModal(false)
      setSelectedTenant(null)
      fetchTenants()
      alert('Tenant updated successfully!')
    } catch (error) {
      console.error('Error updating tenant:', error)
      alert('Failed to update tenant: ' + (error.response?.data?.error || error.message))
    } finally {
      setSaving(false)
    }
  }

  const handleAddSubTenant = (tenant) => {
    setParentTenant(tenant)
    setShowSubTenantModal(true)
  }

  const handleCreateSubTenant = async (e) => {
    e.preventDefault()
    try {
      const user = JSON.parse(localStorage.getItem('user'))
      await axios.post(`/api/tenants/${parentTenant.id}/sub-tenants`, newSubTenant, {
        headers: {
          'x-user-role': user?.role || 'client_user',
          'x-tenant-id': user?.tenantId || ''
        }
      })
      setShowSubTenantModal(false)
      setNewSubTenant({ name: '', domain: '', owner_email: '' })
      fetchTenants()
    } catch (error) {
      console.error('Error creating sub-tenant:', error)
      alert(error.response?.data?.error || 'Failed to create sub-tenant')
    }
  }

  const handleDeleteTenant = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedTenant.name}? This action cannot be undone.`)) {
      return
    }
    
    setSaving(true)
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      await axios.delete(`/api/tenants/${selectedTenant.id}`, {
        headers: {
          'x-user-role': user?.role || 'client',
          'x-tenant-id': user?.tenantId || ''
        }
      })
      setShowManageModal(false)
      setSelectedTenant(null)
      fetchTenants()
      alert('Tenant deleted successfully!')
    } catch (error) {
      console.error('Error deleting tenant:', error)
      alert('Failed to delete tenant')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (status) => {
    setSaving(true)
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      await axios.patch(`/api/tenants/${selectedTenant.id}/status`, { status }, {
        headers: {
          'x-user-role': user?.role || 'client',
          'x-tenant-id': user?.tenantId || ''
        }
      })
      setSelectedTenant({...selectedTenant, status})
      fetchTenants()
      alert(`Tenant ${status === 'active' ? 'activated' : 'suspended'} successfully!`)
    } catch (error) {
      console.error('Error changing status:', error)
      alert('Failed to change status')
    } finally {
      setSaving(false)
    }
  }

  const handleConvertToMSP = async () => {
    if (!confirm(`Are you sure you want to convert ${selectedTenant.name} to an MSP? This will allow them to manage sub-tenants.`)) {
      return
    }

    setSaving(true)
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      await axios.post(`/api/tenants/${selectedTenant.id}/convert-to-msp`, {}, {
        headers: {
          'x-user-role': user?.role || 'client',
          'x-tenant-id': user?.tenantId || ''
        }
      })
      setSelectedTenant({...selectedTenant, tenant_type: 'msp'})
      fetchTenants()
      alert('Tenant converted to MSP successfully!')
    } catch (error) {
      console.error('Error converting to MSP:', error)
      alert(error.response?.data?.error || 'Failed to convert to MSP')
    } finally {
      setSaving(false)
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
      ) : tenants.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🏢</div>
          <h3 className="text-xl font-semibold text-white mb-2">No tenants yet</h3>
          <p className="text-gray-400 mb-6">Get started by adding your first tenant</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-6 rounded-lg transition"
          >
            Add First Tenant
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Group tenants by MSP */}
          {(() => {
            const user = JSON.parse(localStorage.getItem('user'))
            const isGlobalAdmin = user?.role === 'global_admin' || user?.role === 'admin'

            // Group by MSP root
            const mspGroups = {}
            tenants.forEach(tenant => {
              const rootId = tenant.msp_root_id || tenant.id
              if (!mspGroups[rootId]) {
                mspGroups[rootId] = []
              }
              mspGroups[rootId].push(tenant)
            })

            return Object.values(mspGroups).map((group, groupIndex) => {
              const mspTenant = group.find(t => t.id === (t.msp_root_id || t.id))
              const subTenants = group.filter(t => t.id !== mspTenant?.id)

              return (
                <div key={groupIndex} className="space-y-4">
                  {/* MSP Header */}
                  {mspTenant && (
                    <div className="bg-gray-800 rounded-xl p-6 border-2 border-purple-500">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white font-bold text-2xl">
                            {mspTenant.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="text-xl font-bold text-white">{mspTenant.name}</h3>
                              {mspTenant.tenant_type === 'msp' && (
                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-500 bg-opacity-20 text-purple-400 border border-purple-500">
                                  MSP
                                </span>
                              )}
                            </div>
                            <p className="text-purple-400 text-sm">{mspTenant.domain}</p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          mspTenant.status === 'active'
                            ? 'bg-green-500 bg-opacity-10 text-green-400 border border-green-500'
                            : 'bg-red-500 bg-opacity-10 text-red-400 border border-red-500'
                        }`}>
                          {mspTenant.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                        <div className="bg-gray-900 rounded-lg p-3">
                          <div className="text-gray-400">Clients</div>
                          <div className="text-2xl font-bold text-white">{mspTenant.sub_tenant_count || 0}</div>
                        </div>
                        <div className="bg-gray-900 rounded-lg p-3">
                          <div className="text-gray-400">Users</div>
                          <div className="text-2xl font-bold text-white">{mspTenant.user_count || 0}</div>
                        </div>
                        <div className="bg-gray-900 rounded-lg p-3">
                          <div className="text-gray-400">Owner</div>
                          <div className="text-sm text-white truncate">{mspTenant.owner_email}</div>
                        </div>
                        <div className="bg-gray-900 rounded-lg p-3">
                          <div className="text-gray-400">Created</div>
                          <div className="text-sm text-white">{new Date(mspTenant.created_at).toLocaleDateString()}</div>
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleManage(mspTenant)}
                          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition text-sm font-medium"
                        >
                          Manage
                        </button>
                        {mspTenant.tenant_type === 'msp' && (
                          <button
                            onClick={() => handleAddSubTenant(mspTenant)}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition text-sm font-medium"
                          >
                            + Add Client
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Sub-tenants grid */}
                  {subTenants.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-8">
                      {subTenants.map((tenant) => (
                        <div
                          key={tenant.id}
                          className="bg-gray-800 rounded-xl p-5 border-l-4 border-l-blue-500 border border-gray-700 hover:border-blue-500 transition group"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center space-x-2">
                              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                                {tenant.name.charAt(0)}
                              </div>
                              <span className="text-xs text-blue-400">Client</span>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              tenant.status === 'active'
                                ? 'bg-green-500 bg-opacity-10 text-green-400 border border-green-500'
                                : 'bg-red-500 bg-opacity-10 text-red-400 border border-red-500'
                            }`}>
                              {tenant.status}
                            </span>
                          </div>

                          <h3 className="text-lg font-bold text-white mb-1">{tenant.name}</h3>
                          <p className="text-blue-400 text-xs mb-3">{tenant.domain}</p>

                          <div className="space-y-1 text-xs text-gray-400 mb-3">
                            <div className="flex items-center space-x-1">
                              <span>📧</span>
                              <span className="truncate">{tenant.owner_email}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <span>👥</span>
                              <span>{tenant.user_count || 0} users</span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleManage(tenant)}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg transition text-xs font-medium"
                          >
                            Manage
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          })()}
        </div>
      )}

      {/* Add Tenant Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-6">Add New Tenant</h2>
            
            <form onSubmit={handleAddTenant} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Tenant Name</label>
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
                <label className="block text-sm font-medium text-gray-300 mb-2">Domain</label>
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
                <label className="block text-sm font-medium text-gray-300 mb-2">Owner Email</label>
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
 
      {/* Add Sub-Tenant Modal */}
      {showSubTenantModal && parentTenant && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-4">Add Client to {parentTenant.name}</h2>
            <p className="text-gray-400 mb-6">Create a new sub-tenant for this MSP</p>
            
            <form onSubmit={handleCreateSubTenant} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Client Name</label>
                <input
                  type="text"
                  value={newSubTenant.name}
                  onChange={(e) => setNewSubTenant({ ...newSubTenant, name: e.target.value })}
                  placeholder="Client Company Name"
                  required
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Domain</label>
                <input
                  type="text"
                  value={newSubTenant.domain}
                  onChange={(e) => setNewSubTenant({ ...newSubTenant, domain: e.target.value })}
                  placeholder="client.stratusblue.automara.com"
                  required
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Owner Email</label>
                <input
                  type="email"
                  value={newSubTenant.owner_email}
                  onChange={(e) => setNewSubTenant({ ...newSubTenant, owner_email: e.target.value })}
                  placeholder="admin@client.com"
                  required
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSubTenantModal(false)}
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

      {/* Manage Tenant Modal */}
      {showManageModal && selectedTenant && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-8 max-w-2xl w-full border border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Manage Tenant</h2>
              <button
                onClick={() => setShowManageModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleUpdateTenant} className="space-y-6">
              {/* Tenant Info */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Tenant Information</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Tenant Name</label>
                  <input
                    type="text"
                    value={selectedTenant.name}
                    onChange={(e) => setSelectedTenant({...selectedTenant, name: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Domain</label>
                  <input
                    type="text"
                    value={selectedTenant.domain}
                    onChange={(e) => setSelectedTenant({...selectedTenant, domain: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Owner Email</label>
                  <input
                    type="email"
                    value={selectedTenant.owner_email}
                    onChange={(e) => setSelectedTenant({...selectedTenant, owner_email: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Status Management */}
              <div className="border-t border-gray-700 pt-6">
                <h3 className="text-lg font-semibold text-white mb-4">Status Management</h3>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => handleStatusChange('active')}
                    disabled={selectedTenant.status === 'active' || saving}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ✓ Activate
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusChange('suspended')}
                    disabled={selectedTenant.status === 'suspended' || saving}
                    className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ⏸ Suspend
                  </button>
                </div>
              </div>

              {/* MSP Management (Global Admin Only) */}
              {(() => {
                const user = JSON.parse(localStorage.getItem('user'))
                const isGlobalAdmin = user?.role === 'global_admin' || user?.role === 'admin'
                return isGlobalAdmin && selectedTenant.tenant_type !== 'msp' && !selectedTenant.parent_tenant_id && (
                  <div className="border-t border-gray-700 pt-6">
                    <h3 className="text-lg font-semibold text-white mb-4">MSP Management</h3>
                    <button
                      type="button"
                      onClick={handleConvertToMSP}
                      disabled={saving}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    >
                      <span>🏢</span>
                      <span>Convert to MSP</span>
                    </button>
                    <p className="text-xs text-gray-400 mt-2">
                      Converting to MSP allows this tenant to manage multiple client sub-tenants
                    </p>
                  </div>
                )
              })()}

              {/* Actions */}
              <div className="flex justify-between pt-6 border-t border-gray-700">
                <button
                  type="button"
                  onClick={handleDeleteTenant}
                  disabled={saving}
                  className="bg-red-600 hover:bg-red-700 text-white py-2 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Delete Tenant
                </button>
                
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowManageModal(false)}
                    disabled={saving}
                    className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-6 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-2 px-6 rounded-lg transition disabled:opacity-50 flex items-center space-x-2"
                  >
                    {saving ? (
                      <>
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Changes</span>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default TenantsPage
