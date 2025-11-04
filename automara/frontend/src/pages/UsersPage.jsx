import React, { useState, useEffect } from 'react'
import axios from 'axios'

function UsersPage() {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState(null)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchUsers()
    fetchRoles()
  }, [])

  const fetchUsers = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user'))
      const response = await axios.get('/api/users', {
        headers: {
          'x-user-role': user?.role || 'client_user',
          'x-tenant-id': user?.tenantId || ''
        }
      })
      setUsers(response.data.users || [])
    } catch (error) {
      console.error('Error fetching users:', error)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const fetchRoles = async () => {
    try {
      const response = await axios.get('/api/roles')
      setRoles(response.data.roles || [])
    } catch (error) {
      console.error('Error fetching roles:', error)
    }
  }

  const handleChangeRole = (user) => {
    setSelectedUser(user)
    setShowRoleModal(true)
  }

  const handleUpdateRole = async (newRole) => {
    setSaving(true)
    try {
      const user = JSON.parse(localStorage.getItem('user'))
      await axios.patch(`/api/users/${selectedUser.id}/role`, 
        { role: newRole },
        {
          headers: {
            'x-user-role': user?.role || 'client_user',
            'x-tenant-id': user?.tenantId || ''
          }
        }
      )
      setShowRoleModal(false)
      setSelectedUser(null)
      fetchUsers()
      alert('Role updated successfully!')
    } catch (error) {
      console.error('Error updating role:', error)
      alert(error.response?.data?.error || 'Failed to update role')
    } finally {
      setSaving(false)
    }
  }

  const getRoleBadgeColor = (role) => {
    switch(role) {
      case 'global_admin':
        return 'bg-red-500 bg-opacity-10 text-red-400 border-red-500'
      case 'client_admin':
        return 'bg-purple-500 bg-opacity-10 text-purple-400 border-purple-500'
      case 'client_user':
        return 'bg-blue-500 bg-opacity-10 text-blue-400 border-blue-500'
      default:
        return 'bg-gray-500 bg-opacity-10 text-gray-400 border-gray-500'
    }
  }

  const getRoleDisplayName = (role) => {
    const roleObj = roles.find(r => r.name === role)
    return roleObj?.display_name || role
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">User Management</h1>
        <p className="text-gray-400">Manage user roles and permissions</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                <th className="text-left p-4 text-gray-400 font-semibold">User</th>
                <th className="text-left p-4 text-gray-400 font-semibold">Email</th>
                <th className="text-left p-4 text-gray-400 font-semibold">Tenant</th>
                <th className="text-left p-4 text-gray-400 font-semibold">Role</th>
                <th className="text-left p-4 text-gray-400 font-semibold">Status</th>
                <th className="text-left p-4 text-gray-400 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-gray-700 hover:bg-gray-700 transition">
                  <td className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                        {user.first_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-white font-medium">{user.first_name} {user.last_name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-300">{user.email}</td>
                  <td className="p-4 text-gray-300">{user.tenant_name || 'N/A'}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRoleBadgeColor(user.role)}`}>
                      {getRoleDisplayName(user.role)}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      user.status === 'active' 
                        ? 'bg-green-500 bg-opacity-10 text-green-400 border border-green-500' 
                        : 'bg-gray-500 bg-opacity-10 text-gray-400 border border-gray-500'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => handleChangeRole(user)}
                      className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition text-sm font-medium"
                    >
                      Change Role
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              No users found
            </div>
          )}
        </div>
      )}

      {/* Role Change Modal */}
      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-4">Change User Role</h2>
            
            <div className="mb-6">
              <p className="text-gray-400 mb-2">User: <span className="text-white font-medium">{selectedUser.email}</span></p>
              <p className="text-gray-400">Current Role: <span className="text-white font-medium">{getRoleDisplayName(selectedUser.role)}</span></p>
            </div>

            <div className="space-y-3 mb-6">
              {roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => handleUpdateRole(role.name)}
                  disabled={saving || role.name === selectedUser.role}
                  className={`w-full text-left p-4 rounded-lg border-2 transition ${
                    role.name === selectedUser.role
                      ? 'border-purple-600 bg-purple-600 bg-opacity-20'
                      : 'border-gray-600 hover:border-purple-500 bg-gray-900'
                  } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-semibold">{role.display_name}</span>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getRoleBadgeColor(role.name)}`}>
                      {role.name}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">{role.description}</p>
                </button>
              ))}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowRoleModal(false)}
                disabled={saving}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UsersPage
