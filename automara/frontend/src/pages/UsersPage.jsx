import React, { useState, useEffect } from 'react';
import axios from 'axios';

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // New user form state
  const [newUser, setNewUser] = useState({
    client_name: '',
    first_name: '',
    last_name: '',
    email: '',
    role: 'client_user',
    password: '',
    password_confirmation: ''
  });

  // Edit user form state
  const [editUser, setEditUser] = useState({
    first_name: '',
    last_name: '',
    email: '',
    role: '',
    tenant_name: '',
    password: '',
    password_confirmation: ''
  });

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

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setEditUser({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      role: user.role || '',
      tenant_name: user.tenant_name || '',
      password: '',
      password_confirmation: ''
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      
      // Prepare update data
      const updateData = {
        first_name: editUser.first_name,
        last_name: editUser.last_name,
        email: editUser.email,
        role: editUser.role
      };
      
      // Add tenant name if it exists and user can edit it
      if (editUser.tenant_name) {
        updateData.tenant_name = editUser.tenant_name;
      }
      
      // Add password if provided
      if (editUser.password) {
        if (editUser.password.length < 8) {
          alert('Password must be at least 8 characters long');
          setSaving(false);
          return;
        }
        if (editUser.password !== editUser.password_confirmation) {
          alert('Passwords do not match');
          setSaving(false);
          return;
        }
        updateData.password = editUser.password;
        updateData.password_confirmation = editUser.password_confirmation;
      }

      console.log('Attempting to update user with data:', updateData);
      
      // Try the most likely working endpoints first
      const possibleUpdates = [
        // Try PUT to the users endpoint with ID (most RESTful)
        { method: 'PUT', url: `/api/v1/users/${selectedUser.id}` },
        // Try PATCH to the users endpoint with ID
        { method: 'PATCH', url: `/api/v1/users/${selectedUser.id}` },
        // Try POST to users with ID and action
        { method: 'POST', url: `/api/v1/users/${selectedUser.id}`, data: updateData },
        // Try PUT to admin users endpoint
        { method: 'PUT', url: `/api/admin/users/${selectedUser.id}` },
        // Try PATCH to admin users endpoint
        { method: 'PATCH', url: `/api/admin/users/${selectedUser.id}` },
        // Try POST to admin users with action
        { method: 'POST', url: `/api/admin/users/${selectedUser.id}`, data: updateData },
        // Try POST to users update endpoint
        { method: 'POST', url: `/api/users/${selectedUser.id}/update`, data: updateData },
        // Try POST to admin users update endpoint
        { method: 'POST', url: `/api/admin/users/${selectedUser.id}/update`, data: updateData }
      ];

      let success = false;
      let lastError = null;

      for (const update of possibleUpdates) {
        try {
          const requestData = update.data || updateData;
          console.log(`Trying ${update.method} ${update.url}`);
          
          const response = await axios({
            method: update.method,
            url: update.url,
            data: requestData,
            headers: {
              'x-user-role': user?.role || 'client_user',
              'x-tenant-id': user?.tenantId || '',
              'Content-Type': 'application/json'
            }
          });
          
          console.log(`Success with ${update.method} ${update.url}:`, response.data);
          success = true;
          break;
        } catch (error) {
          lastError = error;
          console.log(`${update.method} ${update.url} failed:`, {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message
          });
          
          // If we get a 404, try next endpoint
          if (error.response?.status === 404) {
            console.log(`404 for ${update.method} ${update.url}, trying next...`);
            continue;
          }
          
          // If we get a method not allowed, log it but continue
          if (error.response?.status === 405) {
            console.log(`405 Method Not Allowed for ${update.method} ${update.url}`);
            continue;
          }
          
          // If we get validation errors, show them and stop
          if (error.response?.status === 422 || error.response?.status === 400) {
            console.log('Validation error, stopping attempts');
            break;
          }
        }
      }

      if (!success) {
        // Provide more detailed error information
        let errorMessage = 'Unknown error occurred';
        
        if (lastError?.response) {
          const errorData = lastError.response.data;
          if (errorData?.error) {
            errorMessage = errorData.error;
          } else if (errorData?.message) {
            errorMessage = errorData.message;
          } else if (errorData?.errors) {
            // Handle validation errors
            const errors = Object.entries(errorData.errors)
              .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
              .join('; ');
            errorMessage = `Validation errors: ${errors}`;
          } else {
            errorMessage = `HTTP ${lastError.response.status}: ${lastError.response.statusText}`;
          }
        } else if (lastError?.request) {
          errorMessage = 'No response received from server. Please check your network connection.';
        } else {
          errorMessage = lastError?.message || 'An unexpected error occurred';
        }
        
        throw new Error(errorMessage);
      }

      setShowEditModal(false);
      setSelectedUser(null);
      fetchUsers();
      alert('User updated successfully!');
    } catch (error) {
      console.error('Error updating user:', error);
      
      // Show user-friendly error message
      alert(`Failed to update user: ${error.message}\n\nCheck the console for detailed error information.`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedUser.first_name} ${selectedUser.last_name}? This action cannot be undone.`)) {
      return;
    }
    
    setSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      
      // Try different possible API endpoints for deletion
      const possibleDeletes = [
        { method: 'DELETE', url: `/api/users/${selectedUser.id}` },
        { method: 'DELETE', url: `/api/admin/users/${selectedUser.id}` },
        { method: 'POST', url: `/api/users/${selectedUser.id}/delete` },
        { method: 'POST', url: `/api/admin/users/${selectedUser.id}/delete` },
        { method: 'DELETE', url: `/api/v1/users/${selectedUser.id}` }
      ];

      let success = false;
      let lastError = null;

      for (const deleteOp of possibleDeletes) {
        try {
          await axios({
            method: deleteOp.method,
            url: deleteOp.url,
            headers: {
              'x-user-role': user?.role || 'client_user',
              'x-tenant-id': user?.tenantId || ''
            }
          });
          success = true;
          break;
        } catch (error) {
          lastError = error;
          console.log(`${deleteOp.method} ${deleteOp.url} failed:`, error.message);
          continue;
        }
      }

      if (!success) {
        throw lastError;
      }

      setShowEditModal(false);
      setSelectedUser(null);
      fetchUsers();
      alert('User deleted successfully!');
    } catch (error) {
      console.error('Error deleting user:', error);
      alert(`Failed to delete user: ${error.response?.data?.error || error.message || 'Unknown error'}\n\nPlease check the console for more details.`);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    // Basic validation
    if (!newUser.client_name || !newUser.first_name || !newUser.last_name || !newUser.email || !newUser.password) {
      alert('Please fill in all fields');
      setSaving(false);
      return;
    }
    
    if (!/\S+@\S+\.\S+/.test(newUser.email)) {
      alert('Please enter a valid email address');
      setSaving(false);
      return;
    }

    if (newUser.password.length < 8) {
      alert('Password must be at least 8 characters long');
      setSaving(false);
      return;
    }

    if (newUser.password !== newUser.password_confirmation) {
      alert('Passwords do not match');
      setSaving(false);
      return;
    }

    try {
      const user = JSON.parse(localStorage.getItem('user'));
      
      // Try different possible API endpoints for creation
      const possibleCreates = [
        // Try POST to users endpoint (most common)
        { method: 'POST', url: '/api/users' },
        // Try POST to admin users
        { method: 'POST', url: '/api/admin/users' },
        // Try POST to tenant users
        { method: 'POST', url: '/api/tenant/users' },
        // Try POST to v1 endpoint
        { method: 'POST', url: '/api/v1/users' }
      ];

      let success = false;
      let lastError = null;

      for (const create of possibleCreates) {
        try {
          await axios({
            method: create.method,
            url: create.url,
            data: {
              client_name: newUser.client_name,
              first_name: newUser.first_name,
              last_name: newUser.last_name,
              email: newUser.email,
              role: newUser.role,
              password: newUser.password
            },
            headers: {
              'x-user-role': user?.role || 'client_user',
              'x-tenant-id': user?.tenantId || ''
            }
          });
          success = true;
          break;
        } catch (error) {
          lastError = error;
          console.log(`${create.method} ${create.url} failed:`, error.message);
          continue;
        }
      }

      if (!success) {
        throw lastError;
      }

      setShowCreateModal(false);
      setNewUser({
        client_name: '',
        first_name: '',
        last_name: '',
        email: '',
        role: 'client_user',
        password: '',
        password_confirmation: ''
      });
      fetchUsers();
      alert('User created successfully!');
    } catch (error) {
      console.error('Error creating user:', error);
      console.error('Create data sent:', {
        client_name: newUser.client_name,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        email: newUser.email,
        role: newUser.role
      });
      alert(`Failed to create user: ${error.response?.data?.error || error.message || 'Unknown error'}\n\nPlease check the console for more details.`);
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
        return 'bg-theme-primary/10 text-theme-accent border-theme-primary/20';
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

  // Check if current user is global admin
  const currentUser = JSON.parse(localStorage.getItem('user'));
  const isGlobalAdmin = currentUser?.role === 'global_admin';

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-theme-primary/30 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-theme-primary rounded-full animate-spin"></div>
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
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-theme-accent via-theme-accent-alt to-theme-accent bg-clip-text text-transparent mb-3">
            User Management
          </h1>
          <p className="text-slate-400 text-lg">Manage user roles and permissions</p>
        </div>

        {/* Create User Button (Global Admin Only) */}
        {isGlobalAdmin && (
          <div className="mb-8">
            <button
              onClick={() => setShowCreateModal(true)}
              className="group px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl font-semibold shadow-lg shadow-green-500/25 hover:shadow-green-500/40 transition-all duration-300 hover:scale-105 flex items-center gap-2"
            >
              <svg className="w-5 h-5 flex items-center justify-center" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>Create New User</span>
            </button>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center justify-center pointer-events-none">
            <svg className="w-5 h-5 flex items-center justify-center" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search users by name, email, or tenant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-slate-900/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/20 transition-all"
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
                          <div className="w-12 h-12 bg-gradient-to-br from-theme-primary-dark to-theme-secondary-dark rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-theme-primary/25">
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
                        <svg className="w-4 h-4 flex items-center justify-center" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                        </svg>
                        <span className="text-slate-300">{user.email}</span>
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 flex items-center justify-center" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span className="text-slate-300">{user.tenant_name || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="p-6">
                      <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border ${getRoleBadgeColor(user.role)}`}>
                        <svg className="w-3 h-3 flex items-center justify-center" fill="currentColor" viewBox="0 0 20 20">
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
                        onClick={() => handleEditUser(user)}
                        className="group px-4 py-2.5 bg-theme-primary/10 text-theme-accent border border-theme-primary/20 rounded-lg font-medium transition-all hover:bg-theme-primary/20 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 flex items-center justify-center" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2h-7m-1 7l-4-4m0 0l4 4m0-4h5" />
                        </svg>
                        <span>Edit User</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredUsers.length === 0 && (
              <div className="text-center py-20">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-theme-primary-dark/20 to-theme-secondary-dark/20 rounded-2xl flex items-center justify-center">
                  <svg className="w-10 h-10 flex items-center justify-center" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <div className="w-12 h-12 bg-gradient-to-br from-theme-primary-dark/20 to-theme-secondary-dark/20 rounded-xl flex items-center justify-center border border-theme-primary/20">
                <svg className="w-6 h-6 flex items-center justify-center" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <svg className="w-6 h-6 flex items-center justify-center" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <svg className="w-6 h-6 flex items-center justify-center" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {/* Edit User Modal - Centered */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl border border-slate-800 shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col">
            <div className="relative p-8 border-b border-slate-800">
              <div className="absolute inset-0 bg-gradient-to-r from-theme-primary-dark/10 to-theme-secondary-dark/10"></div>
              <div className="relative flex items-start justify-between">
                <div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-theme-accent to-theme-accent-alt bg-clip-text text-transparent mb-2">
                    Edit User
                  </h2>
                  <p className="text-slate-400">Update user information and settings</p>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6 text-slate-400 hover:text-white flex items-center justify-center" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              <form onSubmit={handleUpdateUser} className="space-y-6">
                {/* User Information */}
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 text-center">User Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-300 text-sm font-medium mb-2 text-center">First Name</label>
                      <input
                        type="text"
                        value={editUser.first_name}
                        onChange={(e) => setEditUser({...editUser, first_name: e.target.value})}
                        placeholder="Enter first name"
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/20 transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 text-sm font-medium mb-2 text-center">Last Name</label>
                      <input
                        type="text"
                        value={editUser.last_name}
                        onChange={(e) => setEditUser({...editUser, last_name: e.target.value})}
                        placeholder="Enter last name"
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/20 transition-all"
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-slate-300 text-sm font-medium mb-2 text-center">Email Address</label>
                      <input
                        type="email"
                        value={editUser.email}
                        onChange={(e) => setEditUser({...editUser, email: e.target.value})}
                        placeholder="Enter email address"
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/20 transition-all"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Account Settings */}
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 text-center">Account Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-300 text-sm font-medium mb-2 text-center">Role</label>
                      <select
                        value={editUser.role}
                        onChange={(e) => setEditUser({...editUser, role: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/20 transition-all"
                        required
                      >
                        {roles.map((role) => (
                          <option key={role.id} value={role.name}>
                            {role.display_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-300 text-sm font-medium mb-2 text-center">Tenant Name</label>
                      <input
                        type="text"
                        value={editUser.tenant_name}
                        onChange={(e) => setEditUser({...editUser, tenant_name: e.target.value})}
                        placeholder="Enter tenant name"
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/20 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Security Section */}
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 text-center">Security (Optional)</h3>
                  <p className="text-slate-400 text-sm mb-4 text-center">Leave these fields empty if you don't want to change the password</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-300 text-sm font-medium mb-2 text-center">New Password</label>
                      <input
                        type="password"
                        value={editUser.password}
                        onChange={(e) => setEditUser({...editUser, password: e.target.value})}
                        placeholder="Enter new password (minimum 8 characters)"
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/20 transition-all"
                        minLength={8}
                      />
                      <p className="text-slate-400 text-xs mt-1 text-center">Password must be at least 8 characters long</p>
                    </div>
                    <div>
                      <label className="block text-slate-300 text-sm font-medium mb-2 text-center">Confirm New Password</label>
                      <input
                        type="password"
                        value={editUser.password_confirmation}
                        onChange={(e) => setEditUser({...editUser, password_confirmation: e.target.value})}
                        placeholder="Confirm new password"
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/20 transition-all"
                        minLength={8}
                      />
                    </div>
                  </div>
                </div>

                {/* Current User Info */}
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 text-center">Current User Information</h3>
                  <div className="flex flex-col items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-theme-primary-dark to-theme-secondary-dark rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-theme-primary/25">
                      {getInitials(selectedUser)}
                    </div>
                    <div className="text-center">
                      <p className="text-white font-semibold text-lg">
                        {selectedUser.first_name} {selectedUser.last_name}
                      </p>
                      <p className="text-slate-400">{selectedUser.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-center">
                    <div>
                      <span className="text-slate-400">Current Role:</span>
                      <span className={`ml-2 inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold border ${getRoleBadgeColor(selectedUser.role)}`}>
                        {getRoleDisplayName(selectedUser.role)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">User ID:</span>
                      <span className="ml-2 text-slate-300 font-mono">{selectedUser.id}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-6">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    disabled={saving}
                    className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || (editUser.password && editUser.password !== editUser.password_confirmation) || (editUser.password && editUser.password.length < 8)}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-theme-primary-dark to-theme-secondary-dark hover:from-theme-primary hover:to-theme-secondary rounded-xl font-semibold shadow-lg shadow-theme-primary/25 hover:shadow-theme-primary/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                        <span>Updating User...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5 flex items-center justify-center" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2h-7m-1 7l-4-4m0 0l4 4m0-4h5" />
                        </svg>
                        <span>Update User</span>
                      </div>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal - Already Centered */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl border border-slate-800 shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col">
            <div className="relative p-8 border-b border-slate-800">
              <div className="absolute inset-0 bg-gradient-to-r from-green-600/10 to-emerald-600/10"></div>
              <div className="relative flex items-start justify-between">
                <div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent mb-2">
                    Create New User
                  </h2>
                  <p className="text-slate-400">Add a new user to the system</p>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6 text-slate-400 hover:text-white flex items-center justify-center" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              <form onSubmit={handleCreateUser} className="space-y-6">
                {/* Client Information */}
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 text-center">Client Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-300 text-sm font-medium mb-2 text-center">Client Name</label>
                      <input
                        type="text"
                        value={newUser.client_name}
                        onChange={(e) => setNewUser({...newUser, client_name: e.target.value})}
                        placeholder="Enter client name"
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 text-sm font-medium mb-2 text-center">Role</label>
                      <select
                        value={newUser.role}
                        onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 transition-all"
                        required
                      >
                        {roles.map((role) => (
                          <option key={role.id} value={role.name}>
                            {role.display_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* User Details */}
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 text-center">User Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-300 text-sm font-medium mb-2 text-center">First Name</label>
                      <input
                        type="text"
                        value={newUser.first_name}
                        onChange={(e) => setNewUser({...newUser, first_name: e.target.value})}
                        placeholder="Enter first name"
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 text-sm font-medium mb-2 text-center">Last Name</label>
                      <input
                        type="text"
                        value={newUser.last_name}
                        onChange={(e) => setNewUser({...newUser, last_name: e.target.value})}
                        placeholder="Enter last name"
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 transition-all"
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-slate-300 text-sm font-medium mb-2 text-center">Email Address</label>
                      <input
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                        placeholder="Enter email address"
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 transition-all"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Password Section */}
                <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 text-center">Security</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-300 text-sm font-medium mb-2 text-center">Password</label>
                      <input
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                        placeholder="Enter password (minimum 8 characters)"
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 transition-all"
                        minLength={8}
                        required
                      />
                      <p className="text-slate-400 text-xs mt-1 text-center">Password must be at least 8 characters long</p>
                    </div>
                    <div>
                      <label className="block text-slate-300 text-sm font-medium mb-2 text-center">Confirm Password</label>
                      <input
                        type="password"
                        value={newUser.password_confirmation}
                        onChange={(e) => setNewUser({...newUser, password_confirmation: e.target.value})}
                        placeholder="Confirm password"
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 transition-all"
                        minLength={8}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-6">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    disabled={saving}
                    className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || newUser.password !== newUser.password_confirmation || newUser.password.length < 8}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl font-semibold shadow-lg shadow-green-500/25 hover:shadow-green-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                        <span>Creating User...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5 flex items-center justify-center" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        <span>Create User</span>
                      </div>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsersPage;