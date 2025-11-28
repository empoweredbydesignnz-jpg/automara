import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';

function TicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [newTicket, setNewTicket] = useState({
    subject: '',
    description: '',
    priority: 'medium',
    category: ''
  });
  const [newComment, setNewComment] = useState('');

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const currentTenant = JSON.parse(localStorage.getItem('currentTenant') || '{}');
  const { currentTheme } = useTheme();

  useEffect(() => {
    fetchTickets();
    fetchStats();
    fetchCategories();
  }, [filterStatus, filterPriority, searchQuery]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterPriority) params.priority = filterPriority;
      if (searchQuery) params.search = searchQuery;

      const response = await axios.get('/api/tickets', {
        params,
        headers: {
          'x-user-role': user?.role || 'client_user',
          'x-tenant-id': currentTenant?.id || '',
          'x-user-id': user?.id || ''
        }
      });

      setTickets(response.data.tickets || []);
    } catch (err) {
      console.error('Error fetching tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/tickets/stats', {
        headers: {
          'x-user-role': user?.role || 'client_user',
          'x-tenant-id': currentTenant?.id || '',
          'x-user-id': user?.id || ''
        }
      });

      setStats(response.data.stats);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/api/tickets/categories/list', {
        headers: {
          'x-user-role': user?.role || 'client_user',
          'x-tenant-id': currentTenant?.id || '',
          'x-user-id': user?.id || ''
        }
      });

      setCategories(response.data.categories || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchTicketDetails = async (ticketId) => {
    try {
      const response = await axios.get(`/api/tickets/${ticketId}`, {
        headers: {
          'x-user-role': user?.role || 'client_user',
          'x-tenant-id': currentTenant?.id || '',
          'x-user-id': user?.id || ''
        }
      });

      setSelectedTicket(response.data.ticket);
    } catch (err) {
      console.error('Error fetching ticket details:', err);
    }
  };

  const createTicket = async () => {
    try {
      if (!newTicket.subject || !newTicket.description) {
        alert('Please fill in subject and description');
        return;
      }

      await axios.post('/api/tickets', newTicket, {
        headers: {
          'x-user-role': user?.role || 'client_user',
          'x-tenant-id': currentTenant?.id || '',
          'x-user-id': user?.id || ''
        }
      });

      setShowNewTicketModal(false);
      setNewTicket({ subject: '', description: '', priority: 'medium', category: '' });
      fetchTickets();
      fetchStats();
    } catch (err) {
      console.error('Error creating ticket:', err);
      alert('Failed to create ticket');
    }
  };

  const updateTicketStatus = async (ticketId, newStatus) => {
    try {
      await axios.patch(`/api/tickets/${ticketId}`,
        { status: newStatus },
        {
          headers: {
            'x-user-role': user?.role || 'client_user',
            'x-tenant-id': currentTenant?.id || '',
            'x-user-id': user?.id || ''
          }
        }
      );

      fetchTickets();
      fetchStats();
      if (selectedTicket && selectedTicket.id === ticketId) {
        fetchTicketDetails(ticketId);
      }
    } catch (err) {
      console.error('Error updating ticket status:', err);
      alert('Failed to update ticket status');
    }
  };

  const updateTicketPriority = async (ticketId, newPriority) => {
    try {
      await axios.patch(`/api/tickets/${ticketId}`,
        { priority: newPriority },
        {
          headers: {
            'x-user-role': user?.role || 'client_user',
            'x-tenant-id': currentTenant?.id || '',
            'x-user-id': user?.id || ''
          }
        }
      );

      fetchTickets();
      fetchStats();
      if (selectedTicket && selectedTicket.id === ticketId) {
        fetchTicketDetails(ticketId);
      }
    } catch (err) {
      console.error('Error updating ticket priority:', err);
      alert('Failed to update ticket priority');
    }
  };

  const addComment = async () => {
    try {
      if (!newComment.trim()) {
        alert('Please enter a comment');
        return;
      }

      await axios.post(`/api/tickets/${selectedTicket.id}/comments`,
        { comment: newComment },
        {
          headers: {
            'x-user-role': user?.role || 'client_user',
            'x-tenant-id': currentTenant?.id || '',
            'x-user-id': user?.id || ''
          }
        }
      );

      setNewComment('');
      fetchTicketDetails(selectedTicket.id);
    } catch (err) {
      console.error('Error adding comment:', err);
      alert('Failed to add comment');
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'high': return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'low': return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
      default: return 'text-slate-400 bg-slate-700/20 border-slate-600/30';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'text-green-400 bg-green-500/20 border-green-500/30';
      case 'in_progress': return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
      case 'waiting_customer': return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
      case 'waiting_internal': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'resolved': return 'text-purple-400 bg-purple-500/20 border-purple-500/30';
      case 'closed': return 'text-slate-400 bg-slate-700/20 border-slate-600/30';
      default: return 'text-slate-400 bg-slate-700/20 border-slate-600/30';
    }
  };

  const formatStatus = (status) => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (loading && tickets.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-400">Loading tickets...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-theme-accent via-theme-accent-alt to-theme-accent bg-clip-text text-transparent">
              Support Tickets
            </h1>
            <button
              onClick={() => setShowNewTicketModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-theme-primary to-theme-secondary text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-theme-primary/50 transition-all duration-300"
            >
              + New Ticket
            </button>
          </div>
          <p className="text-slate-400 text-lg">
            {user?.role === 'global_admin' ? 'Manage all tickets across tenants' : 'View and manage your support tickets'}
          </p>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
            <div className="glass-card p-4 rounded-xl">
              <div className="text-slate-400 text-sm mb-1">Total</div>
              <div className="text-2xl font-bold text-white">{stats.total}</div>
            </div>
            <div className="glass-card p-4 rounded-xl">
              <div className="text-slate-400 text-sm mb-1">Open</div>
              <div className="text-2xl font-bold text-green-400">{stats.open}</div>
            </div>
            <div className="glass-card p-4 rounded-xl">
              <div className="text-slate-400 text-sm mb-1">In Progress</div>
              <div className="text-2xl font-bold text-blue-400">{stats.in_progress}</div>
            </div>
            <div className="glass-card p-4 rounded-xl">
              <div className="text-slate-400 text-sm mb-1">Waiting</div>
              <div className="text-2xl font-bold text-orange-400">{parseInt(stats.waiting_customer) + parseInt(stats.waiting_internal)}</div>
            </div>
            <div className="glass-card p-4 rounded-xl">
              <div className="text-slate-400 text-sm mb-1">Resolved</div>
              <div className="text-2xl font-bold text-purple-400">{stats.resolved}</div>
            </div>
            <div className="glass-card p-4 rounded-xl">
              <div className="text-slate-400 text-sm mb-1">Closed</div>
              <div className="text-2xl font-bold text-slate-400">{stats.closed}</div>
            </div>
            <div className="glass-card p-4 rounded-xl">
              <div className="text-slate-400 text-sm mb-1">Urgent</div>
              <div className="text-2xl font-bold text-red-400">{stats.urgent}</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="glass-card p-6 rounded-xl mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Search</label>
              <input
                type="text"
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-theme-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Filter by Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-theme-primary"
              >
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting_customer">Waiting Customer</option>
                <option value="waiting_internal">Waiting Internal</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Filter by Priority</label>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="w-full px-4 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-theme-primary"
              >
                <option value="">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tickets List */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left p-4 text-slate-400 font-semibold">Ticket</th>
                  <th className="text-left p-4 text-slate-400 font-semibold">Subject</th>
                  {user?.role === 'global_admin' && (
                    <th className="text-left p-4 text-slate-400 font-semibold">Tenant</th>
                  )}
                  <th className="text-left p-4 text-slate-400 font-semibold">Status</th>
                  <th className="text-left p-4 text-slate-400 font-semibold">Priority</th>
                  <th className="text-left p-4 text-slate-400 font-semibold">Category</th>
                  <th className="text-left p-4 text-slate-400 font-semibold">Comments</th>
                  <th className="text-left p-4 text-slate-400 font-semibold">Created</th>
                  <th className="text-left p-4 text-slate-400 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={user?.role === 'global_admin' ? 9 : 8} className="text-center p-8 text-slate-400">
                      No tickets found. Create your first ticket!
                    </td>
                  </tr>
                ) : (
                  tickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className="border-b border-slate-800 hover:bg-slate-900/30 cursor-pointer transition-colors"
                      onClick={() => fetchTicketDetails(ticket.id)}
                    >
                      <td className="p-4">
                        <div className="font-mono text-sm text-theme-accent">{ticket.ticket_number}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-white truncate max-w-xs">{ticket.subject}</div>
                        <div className="text-sm text-slate-400 truncate max-w-xs">{ticket.creator_first_name} {ticket.creator_last_name}</div>
                      </td>
                      {user?.role === 'global_admin' && (
                        <td className="p-4">
                          <div className="text-sm text-slate-300">{ticket.tenant_name}</div>
                        </td>
                      )}
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${getStatusColor(ticket.status)}`}>
                          {formatStatus(ticket.status)}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-slate-300">{ticket.category || '-'}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-slate-400">{ticket.comment_count}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-slate-400">
                          {new Date(ticket.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            fetchTicketDetails(ticket.id);
                          }}
                          className="text-theme-accent hover:text-theme-accent-alt transition-colors"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* New Ticket Modal */}
      {showNewTicketModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl p-8 max-w-2xl w-full border border-slate-800">
            <h2 className="text-2xl font-bold text-white mb-6">Create New Ticket</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Subject *</label>
                <input
                  type="text"
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-theme-primary"
                  placeholder="Brief description of the issue"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Description *</label>
                <textarea
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  rows={6}
                  className="w-full px-4 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-theme-primary resize-none"
                  placeholder="Detailed description of the issue..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Priority</label>
                  <select
                    value={newTicket.priority}
                    onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-theme-primary"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Category</label>
                  <select
                    value={newTicket.category}
                    onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-theme-primary"
                  >
                    <option value="">Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4 mt-8">
              <button
                onClick={() => {
                  setShowNewTicketModal(false);
                  setNewTicket({ subject: '', description: '', priority: 'medium', category: '' });
                }}
                className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createTicket}
                className="px-6 py-2 bg-gradient-to-r from-theme-primary to-theme-secondary text-white rounded-lg hover:shadow-lg hover:shadow-theme-primary/50 transition-all"
              >
                Create Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Details Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-slate-900 rounded-2xl p-8 max-w-4xl w-full border border-slate-800 my-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="text-sm text-slate-400 mb-1">{selectedTicket.ticket_number}</div>
                <h2 className="text-2xl font-bold text-white">{selectedTicket.subject}</h2>
                <div className="flex items-center gap-3 mt-2">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${getStatusColor(selectedTicket.status)}`}>
                    {formatStatus(selectedTicket.status)}
                  </span>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${getPriorityColor(selectedTicket.priority)}`}>
                    {selectedTicket.priority.charAt(0).toUpperCase() + selectedTicket.priority.slice(1)}
                  </span>
                  {selectedTicket.category && (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300">
                      {selectedTicket.category}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Ticket Info */}
            <div className="bg-slate-950/50 rounded-xl p-6 mb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-slate-400 mb-1">Created By</div>
                  <div className="text-white font-medium">{selectedTicket.creator_first_name} {selectedTicket.creator_last_name}</div>
                </div>
                <div>
                  <div className="text-slate-400 mb-1">Created</div>
                  <div className="text-white">{new Date(selectedTicket.created_at).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-slate-400 mb-1">Last Updated</div>
                  <div className="text-white">{new Date(selectedTicket.updated_at).toLocaleString()}</div>
                </div>
                {user?.role === 'global_admin' && (
                  <div>
                    <div className="text-slate-400 mb-1">Tenant</div>
                    <div className="text-white">{selectedTicket.tenant_name}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-3">Description</h3>
              <div className="bg-slate-950/50 rounded-xl p-6">
                <p className="text-slate-300 whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>
            </div>

            {/* Update Status and Priority */}
            {['global_admin', 'client_admin', 'msp_admin'].includes(user?.role) && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Update Status</label>
                  <select
                    value={selectedTicket.status}
                    onChange={(e) => updateTicketStatus(selectedTicket.id, e.target.value)}
                    className="w-full px-4 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-theme-primary"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="waiting_customer">Waiting Customer</option>
                    <option value="waiting_internal">Waiting Internal</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Update Priority</label>
                  <select
                    value={selectedTicket.priority}
                    onChange={(e) => updateTicketPriority(selectedTicket.id, e.target.value)}
                    className="w-full px-4 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-theme-primary"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
            )}

            {/* Comments */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-3">
                Comments ({selectedTicket.comments?.length || 0})
              </h3>

              <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
                {selectedTicket.comments && selectedTicket.comments.length > 0 ? (
                  selectedTicket.comments.map((comment) => (
                    <div key={comment.id} className="bg-slate-950/50 rounded-xl p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="text-white font-medium">{comment.user_first_name} {comment.user_last_name}</span>
                          <span className="text-slate-400 text-sm ml-2">{comment.user_role}</span>
                        </div>
                        <span className="text-slate-400 text-sm">{new Date(comment.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-300 whitespace-pre-wrap">{comment.comment}</p>
                      {comment.is_internal && (
                        <span className="inline-block mt-2 px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded">Internal Note</span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center text-slate-400 py-8">No comments yet</div>
                )}
              </div>

              {/* Add Comment */}
              <div>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                  placeholder="Add a comment..."
                  className="w-full px-4 py-2 bg-slate-950/50 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-theme-primary resize-none mb-2"
                />
                <div className="flex justify-end">
                  <button
                    onClick={addComment}
                    className="px-6 py-2 bg-gradient-to-r from-theme-primary to-theme-secondary text-white rounded-lg hover:shadow-lg hover:shadow-theme-primary/50 transition-all"
                  >
                    Add Comment
                  </button>
                </div>
              </div>
            </div>

            {/* Activity Log */}
            {selectedTicket.activity && selectedTicket.activity.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Activity Log</h3>
                <div className="bg-slate-950/50 rounded-xl p-4 max-h-48 overflow-y-auto">
                  <div className="space-y-2">
                    {selectedTicket.activity.map((activity) => (
                      <div key={activity.id} className="text-sm flex items-start gap-2">
                        <span className="text-slate-400">{new Date(activity.created_at).toLocaleString()}</span>
                        <span className="text-slate-500">•</span>
                        <span className="text-slate-300">
                          {activity.user_first_name} {activity.user_last_name} {activity.action}
                          {activity.old_value && activity.new_value && (
                            <span> from <span className="font-mono text-xs bg-slate-800 px-1 rounded">{activity.old_value}</span> to <span className="font-mono text-xs bg-slate-800 px-1 rounded">{activity.new_value}</span></span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TicketsPage;
