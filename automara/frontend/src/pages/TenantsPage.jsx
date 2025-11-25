import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { plans, ADDITIONAL_AUTOMATION_PRICE } from '../context/BillingContext';

function TenantsPage() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showBillingDetails, setShowBillingDetails] = useState(false);

  // Get current user for role check
  const user = JSON.parse(localStorage.getItem('user'));

  // Mock tenant billing data (in production, this would come from the backend)
  const getTenantBilling = (tenantId) => {
    // Simulated billing data per tenant
    const billingData = {
      plan: 'starter',
      purchases: [
        { id: 1, type: 'plan', name: 'Automara Starter', amount: 29, date: '2025-01-15' },
        { id: 2, type: 'automation', name: 'Email Automation', amount: 10, date: '2025-01-20' },
        { id: 3, type: 'automation', name: 'Slack Integration', amount: 10, date: '2025-02-01' },
      ]
    };
    return billingData;
  };
  const [newTenant, setNewTenant] = useState({
    name: '',
    domain: '',
    owner_email: ''
  });
  const [showSubTenantModal, setShowSubTenantModal] = useState(false);
  const [parentTenant, setParentTenant] = useState(null);
  const [newSubTenant, setNewSubTenant] = useState({
    name: '',
    domain: '',
    owner_email: ''
  });

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      console.log('Fetching tenants with role:', user?.role);
      
      const response = await axios.get('/api/tenants', {
        headers: {
          'x-user-role': user?.role || 'client_user',
          'x-tenant-id': user?.tenantId || ''
        }
      });
      
      console.log('Tenants response:', response.data);
      setTenants(response.data.tenants || []);
    } catch (error) {
      console.error('Error fetching tenants:', error);
      console.error('Error details:', error.response?.data);
      alert('Failed to load tenants: ' + (error.response?.data?.error || error.message));
      setTenants([]);
    } finally {
      setLoading(false);
    }
  };

  const handleManage = (tenant) => {
    setSelectedTenant(tenant);
    setShowManageModal(true);
  };

  const handleAddTenant = async (e) => {
    e.preventDefault();
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      await axios.post('/api/tenants', newTenant, {
        headers: {
          'x-user-role': user?.role || 'client_user',
          'x-tenant-id': user?.tenantId || ''
        }
      });
      setShowAddModal(false);
      setNewTenant({ name: '', domain: '', owner_email: '' });
      fetchTenants();
      alert('Tenant created successfully!');
    } catch (error) {
      console.error('Error adding tenant:', error);
      alert('Failed to create tenant: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleUpdateTenant = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem('user'));

      // Prepare the update payload
      const updatePayload = {
        name: selectedTenant.name,
        domain: selectedTenant.domain,
        owner_email: selectedTenant.owner_email
      };

      // Only include billing_plan if user is global_admin
      if (user?.role === 'global_admin' && selectedTenant.billing_plan) {
        updatePayload.billing_plan = selectedTenant.billing_plan;
      }

      await axios.put(`/api/tenants/${selectedTenant.id}`, updatePayload, {
        headers: {
          'x-user-role': user?.role || 'client_user',
          'x-tenant-id': user?.tenantId || ''
        }
      });
      setShowManageModal(false);
      setSelectedTenant(null);
      fetchTenants();
      alert('Tenant updated successfully!');
    } catch (error) {
      console.error('Error updating tenant:', error);
      alert('Failed to update tenant: ' + (error.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleAddSubTenant = (tenant) => {
    setParentTenant(tenant);
    setShowSubTenantModal(true);
  };

  const handleCreateSubTenant = async (e) => {
    e.preventDefault();
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      await axios.post(`/api/tenants/${parentTenant.id}/sub-tenants`, newSubTenant, {
        headers: {
          'x-user-role': user?.role || 'client_user',
          'x-tenant-id': user?.tenantId || ''
        }
      });
      setShowSubTenantModal(false);
      setNewSubTenant({ name: '', domain: '', owner_email: '' });
      fetchTenants();
    } catch (error) {
      console.error('Error creating sub-tenant:', error);
      alert(error.response?.data?.error || 'Failed to create sub-tenant');
    }
  };

  const handleDeleteTenant = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedTenant.name}? This action cannot be undone.`)) {
      return;
    }
    
    setSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      await axios.delete(`/api/tenants/${selectedTenant.id}`, {
        headers: {
          'x-user-role': user?.role || 'client',
          'x-tenant-id': user?.tenantId || ''
        }
      });
      setShowManageModal(false);
      setSelectedTenant(null);
      fetchTenants();
      alert('Tenant deleted successfully!');
    } catch (error) {
      console.error('Error deleting tenant:', error);
      alert('Failed to delete tenant');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (status) => {
    setSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      await axios.patch(`/api/tenants/${selectedTenant.id}/status`, { status }, {
        headers: {
          'x-user-role': user?.role || 'client',
          'x-tenant-id': user?.tenantId || ''
        }
      });
      setSelectedTenant({...selectedTenant, status});
      fetchTenants();
      alert(`Tenant ${status === 'active' ? 'activated' : 'suspended'} successfully!`);
    } catch (error) {
      console.error('Error changing status:', error);
      alert('Failed to change status');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-theme-primary/30 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-theme-primary rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-400 text-lg font-medium">Loading tenants...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto animate-fade-in">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-gradient mb-2 tracking-tight">
              Tenants
            </h1>
            <p className="text-slate-400 text-lg tracking-wide">Manage your multi-tenant organizations</p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="group px-6 py-3.5 bg-gradient-to-r from-theme-primary-dark to-theme-secondary-dark rounded-xl font-semibold shadow-lg shadow-theme-primary/25 hover:shadow-theme-primary/40 transition-all duration-300 hover:scale-105 btn-premium flex items-center gap-3"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Tenant</span>
          </button>
        </div>

        {/* Tenants Grid */}
        {tenants.length === 0 ? (
          <div className="text-center py-20 glass-card rounded-2xl">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-theme-primary-dark/20 to-theme-secondary-dark/20 rounded-2xl flex items-center justify-center">
              <svg className="w-10 h-10 text-theme-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-3">No tenants yet</h3>
            <p className="text-slate-400 mb-8 max-w-md mx-auto">Get started by adding your first tenant organization</p>
            <button 
              onClick={() => setShowAddModal(true)}
              className="px-8 py-3 bg-gradient-to-r from-theme-primary-dark to-theme-secondary-dark rounded-xl font-semibold shadow-lg shadow-theme-primary/25 hover:shadow-theme-primary/40 transition-all hover:scale-105"
            >
              Add Your First Tenant
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tenants.map((tenant) => (
              <div
                key={tenant.id}
                className="group relative glass-card rounded-2xl hover:border-theme-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-theme-primary/20 hover:-translate-y-1 overflow-hidden"
              >
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-theme-primary-dark/0 via-theme-primary-dark/0 to-theme-secondary-dark/0 group-hover:from-theme-primary-dark/5 group-hover:to-theme-secondary-dark/5 transition-all duration-300"></div>
                
                <div className="relative p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-gradient-to-br from-theme-primary-dark/20 to-theme-secondary-dark/20 rounded-xl flex items-center justify-center border border-theme-primary/20">
                          <svg className="w-6 h-6 text-theme-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-theme-accent group-hover:to-theme-accent-alt group-hover:bg-clip-text transition-all">
                            {tenant.name}
                          </h3>
                          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                            {tenant.tenant_type || 'Standard'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`relative inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${
                          tenant.status === 'active' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          <div className={`w-2 h-2 rounded-full ${tenant.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></div>
                          {tenant.status === 'active' ? 'Active' : 'Suspended'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-3 mb-4 pb-4 border-b border-slate-800">
                    <div className="flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      <span className="text-slate-400 truncate">{tenant.domain}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="text-slate-400 truncate">{tenant.owner_email}</span>
                    </div>
                    {tenant.sub_tenant_count > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span className="text-slate-400">{tenant.sub_tenant_count} sub-tenant{tenant.sub_tenant_count !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleManage(tenant)}
                      className="px-4 py-2.5 bg-theme-primary/10 text-theme-accent border border-theme-primary/20 rounded-lg font-medium transition-all hover:bg-theme-primary/20 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Manage
                    </button>

                    {tenant.tenant_type === 'msp' && (
                      <button
                        onClick={() => handleAddSubTenant(tenant)}
                        className="px-4 py-2.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg font-medium transition-all hover:bg-blue-500/20 flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Client
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Tenant Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-2xl premium-shadow max-w-2xl w-full overflow-hidden animate-scale-in">
            <div className="relative p-8 border-b border-slate-800">
              <div className="absolute inset-0 bg-gradient-to-r from-theme-primary-dark/10 to-theme-secondary-dark/10"></div>
              <div className="relative flex items-start justify-between">
                <div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-theme-accent to-theme-accent-alt bg-clip-text text-transparent mb-2">
                    Add New Tenant
                  </h2>
                  <p className="text-slate-400">Create a new tenant organization</p>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6 text-slate-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleAddTenant} className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Tenant Name</label>
                <input
                  type="text"
                  value={newTenant.name}
                  onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                  placeholder="Company Name"
                  required
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Domain</label>
                <input
                  type="text"
                  value={newTenant.domain}
                  onChange={(e) => setNewTenant({ ...newTenant, domain: e.target.value })}
                  placeholder="company.automara.com"
                  required
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Owner Email</label>
                <input
                  type="email"
                  value={newTenant.owner_email}
                  onChange={(e) => setNewTenant({ ...newTenant, owner_email: e.target.value })}
                  placeholder="admin@company.com"
                  required
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/20 transition-all"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-theme-primary-dark to-theme-secondary-dark hover:from-theme-primary hover:to-theme-secondary rounded-xl font-semibold shadow-lg shadow-theme-primary/25 hover:shadow-theme-primary/40 transition-all"
                >
                  Create Tenant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Sub-Tenant Modal */}
      {showSubTenantModal && parentTenant && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-2xl premium-shadow max-w-2xl w-full overflow-hidden animate-scale-in">
            <div className="relative p-8 border-b border-slate-800">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-cyan-600/10"></div>
              <div className="relative flex items-start justify-between">
                <div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                    Add Client to {parentTenant.name}
                  </h2>
                  <p className="text-slate-400">Create a new client under this MSP</p>
                </div>
                <button
                  onClick={() => setShowSubTenantModal(false)}
                  className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6 text-slate-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateSubTenant} className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Client Name</label>
                <input
                  type="text"
                  value={newSubTenant.name}
                  onChange={(e) => setNewSubTenant({ ...newSubTenant, name: e.target.value })}
                  placeholder="Client Company Name"
                  required
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Domain</label>
                <input
                  type="text"
                  value={newSubTenant.domain}
                  onChange={(e) => setNewSubTenant({ ...newSubTenant, domain: e.target.value })}
                  placeholder="client.stratusblue.automara.com"
                  required
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Owner Email</label>
                <input
                  type="email"
                  value={newSubTenant.owner_email}
                  onChange={(e) => setNewSubTenant({ ...newSubTenant, owner_email: e.target.value })}
                  placeholder="admin@client.com"
                  required
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSubTenantModal(false)}
                  className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-xl font-semibold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all"
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="glass-card rounded-2xl premium-shadow max-w-2xl w-full my-8 overflow-hidden animate-scale-in">
            <div className="relative p-8 border-b border-slate-800">
              <div className="absolute inset-0 bg-gradient-to-r from-theme-primary-dark/10 to-theme-secondary-dark/10"></div>
              <div className="relative flex items-start justify-between">
                <div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-theme-accent to-theme-accent-alt bg-clip-text text-transparent mb-2">
                    Manage Tenant
                  </h2>
                  <p className="text-slate-400">{selectedTenant.name}</p>
                </div>
                <button
                  onClick={() => setShowManageModal(false)}
                  className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6 text-slate-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleUpdateTenant} className="p-8 space-y-6">
              {/* Tenant Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-theme-primary-dark/20 to-theme-secondary-dark/20 rounded-lg flex items-center justify-center border border-theme-primary/20">
                    <svg className="w-4 h-4 text-theme-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  Tenant Information
                </h3>
                
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Tenant Name</label>
                  <input
                    type="text"
                    value={selectedTenant.name}
                    onChange={(e) => setSelectedTenant({...selectedTenant, name: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Domain</label>
                  <input
                    type="text"
                    value={selectedTenant.domain}
                    onChange={(e) => setSelectedTenant({...selectedTenant, domain: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Owner Email</label>
                  <input
                    type="email"
                    value={selectedTenant.owner_email}
                    onChange={(e) => setSelectedTenant({...selectedTenant, owner_email: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/20 transition-all"
                  />
                </div>
              </div>

              {/* Status Management */}
              <div className="border-t border-slate-800 pt-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-600/20 to-teal-600/20 rounded-lg flex items-center justify-center border border-emerald-500/20">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  Status Management
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleStatusChange('active')}
                    disabled={selectedTenant.status === 'active' || saving}
                    className="px-4 py-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl font-medium transition-all hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Activate
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusChange('suspended')}
                    disabled={selectedTenant.status === 'suspended' || saving}
                    className="px-4 py-3 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl font-medium transition-all hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Suspend
                  </button>
                </div>
              </div>

              {/* Sub-Tenants Management */}
              {selectedTenant.tenant_type === 'msp' && (
                <div className="border-t border-slate-800 pt-6">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 rounded-lg flex items-center justify-center border border-blue-500/20">
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    Sub-Tenants
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowManageModal(false);
                      window.location.href = `/tenants/${selectedTenant.id}/sub-tenants`;
                    }}
                    className="w-full px-4 py-3 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl font-medium transition-all hover:bg-blue-500/20 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Manage Sub-Tenants
                  </button>
                </div>
              )}

              {/* Billing Management - Only for global_admin */}
              {user?.role === 'global_admin' && (
                <div className="border-t border-slate-800 pt-6">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-amber-600/20 to-orange-600/20 rounded-lg flex items-center justify-center border border-amber-500/20">
                      <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    Billing & Plan
                  </h3>

                  {/* Plan Selection */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-400 mb-2">Current Plan</label>
                    <select
                      value={selectedTenant.billing_plan || 'starter'}
                      onChange={(e) => setSelectedTenant({...selectedTenant, billing_plan: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/20 transition-all"
                    >
                      {Object.entries(plans).map(([key, plan]) => (
                        <option key={key} value={key}>
                          {plan.name} - ${plan.price}/mo ({plan.automationLimit} automations)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* View Billing History Button */}
                  <button
                    type="button"
                    onClick={() => setShowBillingDetails(!showBillingDetails)}
                    className="w-full px-4 py-3 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl font-medium transition-all hover:bg-amber-500/20 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    {showBillingDetails ? 'Hide' : 'View'} Billing History
                  </button>

                  {/* Billing Details */}
                  {showBillingDetails && (
                    <div className="mt-4 p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                      <h4 className="text-sm font-semibold text-white mb-3">Purchase History</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {getTenantBilling(selectedTenant.id).purchases.map((purchase) => (
                          <div key={purchase.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                            <div>
                              <div className="text-sm font-medium text-white">{purchase.name}</div>
                              <div className="text-xs text-slate-400">{purchase.date}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-theme-accent">${purchase.amount}</div>
                              <div className="text-xs text-slate-500">/month</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-700 flex items-center justify-between">
                        <span className="text-sm text-slate-400">Total Monthly</span>
                        <span className="text-lg font-bold text-white">
                          ${getTenantBilling(selectedTenant.id).purchases.reduce((sum, p) => sum + p.amount, 0)}/mo
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between pt-6 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleDeleteTenant}
                  disabled={saving}
                  className="px-6 py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl font-medium transition-all hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
                
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowManageModal(false)}
                    disabled={saving}
                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-3 bg-gradient-to-r from-theme-primary-dark to-theme-secondary-dark hover:from-theme-primary hover:to-theme-secondary rounded-xl font-semibold shadow-lg shadow-theme-primary/25 hover:shadow-theme-primary/40 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TenantsPage;
