import React, { useState, useEffect } from 'react';
import axios from 'axios';

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      const response = await axios.get('/api/users', {
        headers: {
          'x-user-role': user?.role || 'client_user',
          'x-tenant-id': user?.tenantId || ''
        }
      });
      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await axios.get('/api/roles');
      setRoles(response.data.roles || []);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const handleChangeRole = (user) => {
    setSelectedUser(user);
    setShowRoleModal(true);
  };

  const handleUpdateRole = async (newRole) => {
    setSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      await axios.patch(`/api/users/${selectedUser.id}/role`, 
        { role: newRole },
        {
          headers: {
            'x-user-role': user?.role || 'client_user',
            'x-tenant-id': user?.tenantId || ''
          }
        }
      );
      setShowRoleModal(false);
      setSelectedUser(null);
      fetchUsers();
      alert('Role updated successfully!');
    } catch (error) {
      console.error('Error updating role:', error);
      alert(error.response?.data?.error || 'Failed to update role');
    } finally {
      setSaving(false);
    }
  };

  const getRoleBadgeColor = (role) => {
    switch(role) {
      case 'global_admin':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'msp_admin':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'client_admin':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'client_user':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getRoleDisplayName = (role) => {
    const roleObj = roles.find(r => r.name === role);
    return roleObj?.display_name || role;
  };

  const getInitials = (user) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase();
    }
    return user.email.charAt(0).toUpperCase();
  };

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.tenant_name && user.tenant_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-purple-500 rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-400 text-lg font-medium">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent mb-3">
            User Management
          </h1>
          <p className="text-slate-400 text-lg">Manage user roles and permissions</p>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search users by name, email, or tenant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-slate-900/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
          />
        </div>

        {/* Users Table */}
        <div className="bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-2xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left p-6 text-slate-400 font-semibold text-sm uppercase tracking-wider">User</th>
                  <th className="text-left p-6 text-slate-400 font-semibold text-sm uppercase tracking-wider">Email</th>
                  <th className="text-left p-6 text-slate-400 font-semibold text-sm uppercase tracking-wider">Tenant</th>
                  <th className="text-left p-6 text-slate-400 font-semibold text-sm uppercase tracking-wider">Role</th>
                  <th className="text-left p-6 text-slate-400 font-semibold text-sm uppercase tracking-wider">Status</th>
                  <th className="text-left p-6 text-slate-400 font-semibold text-sm uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user, index) => (
                  <tr 
                    key={user.id} 
                    className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${
                      index === filteredUsers.length - 1 ? 'border-b-0' : ''
                    }`}
                  >
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-purple-500/25">
                            {getInitials(user)}
                          </div>
                          <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 ${
                            user.status === 'active' ? 'bg-emerald-400' : 'bg-slate-500'
                          }`}></div>
                        </div>
                        <div>
                          <div className="text-white font-semibold text-base">
                            {user.first_name} {user.last_name}
                          </div>
                          <div className="text-slate-400 text-sm">ID: {user.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                        </svg>
                        <span className="text-slate-300">{user.email}</span>
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span className="text-slate-300">{user.tenant_name || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="p-6">
                      <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border ${getRoleBadgeColor(user.role)}`}>
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                        {getRoleDisplayName(user.role)}
                      </span>
                    </td>
                    <td className="p-6">
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border ${
                        user.status === 'active' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${user.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></div>
                        {user.status}
                      </div>
                    </td>
                    <td className="p-6">
                      <button
                        onClick={() => handleChangeRole(user)}
                        className="group px-4 py-2.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg font-medium transition-all hover:bg-purple-500/20 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        Change Role
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredUsers.length === 0 && (
              <div className="text-center py-20">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-2xl flex items-center justify-center">
                  <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {searchQuery ? 'No users found' : 'No users yet'}
                </h3>
                <p className="text-slate-400">
                  {searchQuery ? 'Try adjusting your search terms' : 'Users will appear here once added'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* User Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-xl border border-slate-800 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-xl flex items-center justify-center border border-purple-500/20">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <p className="text-slate-400 text-sm font-medium">Total Users</p>
                <p className="text-2xl font-bold text-white">{users.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-xl border border-slate-800 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-600/20 to-teal-600/20 rounded-xl flex items-center justify-center border border-emerald-500/20">
                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-slate-400 text-sm font-medium">Active Users</p>
                <p className="text-2xl font-bold text-white">{users.filter(u => u.status === 'active').length}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-xl border border-slate-800 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 rounded-xl flex items-center justify-center border border-blue-500/20">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <p className="text-slate-400 text-sm font-medium">Admins</p>
                <p className="text-2xl font-bold text-white">
                  {users.filter(u => u.role.includes('admin')).length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Role Change Modal */}
      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl border border-slate-800 shadow-2xl max-w-2xl w-full overflow-hidden">
            <div className="relative p-8 border-b border-slate-800">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-pink-600/10"></div>
              <div className="relative flex items-start justify-between">
                <div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                    Change User Role
                  </h2>
                  <p className="text-slate-400">Update permissions for this user</p>
                </div>
                <button
                  onClick={() => setShowRoleModal(false)}
                  className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6 text-slate-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-8">
              {/* User Info */}
              <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800 mb-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-purple-500/25">
                    {getInitials(selectedUser)}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-lg">
                      {selectedUser.first_name} {selectedUser.last_name}
                    </p>
                    <p className="text-slate-400">{selectedUser.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-400">Current Role:</span>
                  <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold border ${getRoleBadgeColor(selectedUser.role)}`}>
                    {getRoleDisplayName(selectedUser.role)}
                  </span>
                </div>
              </div>

              {/* Role Selection */}
              <div className="space-y-3 mb-6">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Select New Role</h3>
                {roles.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => handleUpdateRole(role.name)}
                    disabled={saving || role.name === selectedUser.role}
                    className={`group w-full text-left p-5 rounded-xl border-2 transition-all ${
                      role.name === selectedUser.role
                        ? 'border-purple-500/50 bg-purple-500/10'
                        : 'border-slate-800 hover:border-purple-500/30 bg-slate-900/30 hover:bg-slate-900/50'
                    } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white font-semibold text-lg">{role.display_name}</span>
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${getRoleBadgeColor(role.name)}`}>
                        {role.name}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">{role.description}</p>
                    {role.name === selectedUser.role && (
                      <div className="mt-3 flex items-center gap-2 text-purple-400 text-sm font-medium">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Current Role
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRoleModal(false)}
                  disabled={saving}
                  className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsersPage;