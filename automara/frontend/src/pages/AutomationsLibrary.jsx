import React, { useState, useEffect } from 'react'
import axios from 'axios'

function AutomationsLibrary() {
  const [workflows, setWorkflows] = useState([])
  const [myWorkflows, setMyWorkflows] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('library')
  const [syncing, setSyncing] = useState(false)
  const [activating, setActivating] = useState(null)

  useEffect(() => {
    fetchWorkflows()
  }, [])

  const getAuthHeaders = () => {
    const user = JSON.parse(localStorage.getItem('user'))
    return {
      'x-user-id': user?.id?.toString() || '',
      'x-user-role': user?.role || 'client_user',
      'x-tenant-id': user?.tenantId?.toString() || '',
    }
  }

  const fetchWorkflows = async () => {
    try {
      const [templatesResponse, workflowsResponse] = await Promise.all([
        axios.get('/api/workflows/templates', { headers: getAuthHeaders() }),
        axios.get('/api/workflows', { headers: getAuthHeaders() })
      ])
      
      const allWorkflows = workflowsResponse.data.workflows || []
      const user = JSON.parse(localStorage.getItem('user'))
      
      const libraryTemplates = allWorkflows.filter(w => w.is_template === true || w.tenant_id === null)
      const userWorkflows = allWorkflows.filter(w => w.tenant_id === user?.tenantId)
      
      setWorkflows(libraryTemplates)
      setMyWorkflows(userWorkflows)
      
    } catch (error) {
      console.error('Error fetching automations:', error)
      alert('Failed to load automations: ' + (error.response?.data?.error || error.message))
      setWorkflows([])
      setMyWorkflows([])
    } finally {
      setLoading(false)
    }
  }

  const handleSyncN8N = async () => {
    try {
      setSyncing(true)
      await axios.post('/api/workflows/sync', {}, { headers: getAuthHeaders() })
      alert('Workflows synced successfully!')
      await fetchWorkflows()
    } catch (error) {
      console.error('Error syncing N8N workflows:', error)
      alert('Failed to sync workflows: ' + (error.response?.data?.error || error.message))
    } finally {
      setSyncing(false)
    }
  }

  const handleActivateWorkflow = async (workflowId) => {
    try {
      setActivating(workflowId)
      const response = await axios.post(`/api/workflows/${workflowId}/activate`, {}, {
        headers: getAuthHeaders()
      })
      
      if (response.data.success) {
        alert(`Workflow activated successfully!\n\nName: ${response.data.workflow.name}\nFolder: ${response.data.workflow.folder}`)
        await fetchWorkflows()
        setActiveTab('my-workflows')
      }
    } catch (error) {
      console.error('Error activating workflow:', error)
      alert('Failed to activate workflow: ' + (error.response?.data?.message || error.message))
    } finally {
      setActivating(null)
    }
  }

  const handleDeactivateWorkflow = async (workflowId) => {
    if (!window.confirm('Are you sure you want to deactivate this workflow?')) return
    
    try {
      setActivating(workflowId)
      await axios.post(`/api/workflows/${workflowId}/deactivate`, {}, {
        headers: getAuthHeaders()
      })
      alert('Workflow deactivated successfully!')
      await fetchWorkflows()
    } catch (error) {
      console.error('Error deactivating workflow:', error)
      alert('Failed to deactivate workflow: ' + (error.response?.data?.error || error.message))
    } finally {
      setActivating(null)
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Automation Library</h1>
          <p className="text-gray-400">Browse and activate pre-built workflow automations</p>
        </div>
        <button
          onClick={handleSyncN8N}
          disabled={syncing}
          className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-purple-700 hover:to-pink-700 transition flex items-center space-x-2 disabled:opacity-50"
        >
          <span>{syncing ? '⏳' : '🔄'}</span>
          <span>{syncing ? 'Syncing...' : 'Sync n8n'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-700">
        <div className="flex space-x-8">
          <button
            onClick={() => setActiveTab('library')}
            className={`pb-3 px-1 border-b-2 font-medium transition ${
              activeTab === 'library'
                ? 'border-purple-500 text-white'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Automation Library ({workflows.length})
          </button>
          <button
            onClick={() => setActiveTab('my-workflows')}
            className={`pb-3 px-1 border-b-2 font-medium transition ${
              activeTab === 'my-workflows'
                ? 'border-purple-500 text-white'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            My Workflows ({myWorkflows.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        </div>
      ) : activeTab === 'library' ? (
        workflows.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold text-white mb-2">No workflow templates available</h3>
            <p className="text-gray-400 mb-6">Sync with n8n to import workflow templates</p>
            <button
              onClick={handleSyncN8N}
              className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-6 rounded-lg transition"
            >
              Sync n8n
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-purple-500 transition group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                      {workflow.name.charAt(0)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-500 bg-opacity-10 text-purple-400 border border-purple-500">
                      Template
                    </span>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-white mb-2">{workflow.name}</h3>
                <p className="text-purple-400 text-sm mb-4">{workflow.n8n_workflow_id}</p>
                
                <div className="space-y-2 text-sm text-gray-400 mb-4">
                  <div className="flex items-center space-x-2">
                    <span>📝</span>
                    <span>{workflow.description || 'No description available'}</span>
                  </div>
                  {workflow.created_at && (
                    <div className="flex items-center space-x-2">
                      <span>📅</span>
                      <span>Added {new Date(workflow.created_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                <div className="flex space-x-2">
                  <button 
                    onClick={() => handleActivateWorkflow(workflow.id)}
                    disabled={activating === workflow.id}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition text-sm font-medium disabled:opacity-50"
                  >
                    {activating === workflow.id ? 'Activating...' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        myWorkflows.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">⚡</div>
            <h3 className="text-xl font-semibold text-white mb-2">No active workflows yet</h3>
            <p className="text-gray-400 mb-6">Activate workflows from the Automation Library</p>
            <button
              onClick={() => setActiveTab('library')}
              className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-6 rounded-lg transition"
            >
              Browse Library
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myWorkflows.map((workflow) => (
              <div
                key={workflow.id}
                className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-purple-500 transition group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                      {workflow.name.charAt(0)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      workflow.active 
                        ? 'bg-green-500 bg-opacity-10 text-green-400 border border-green-500' 
                        : 'bg-red-500 bg-opacity-10 text-red-400 border border-red-500'
                    }`}>
                      {workflow.active ? 'Active' : 'Inactive'}
                    </span>
                    {workflow.folder_name && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500 bg-opacity-10 text-blue-400 border border-blue-500">
                        {workflow.folder_name}
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="text-xl font-bold text-white mb-2">{workflow.name}</h3>
                <p className="text-purple-400 text-sm mb-4">{workflow.n8n_workflow_id}</p>
                
                <div className="space-y-2 text-sm text-gray-400 mb-4">
                  {workflow.folder_name && (
                    <div className="flex items-center space-x-2">
                      <span>📁</span>
                      <span>Folder: {workflow.folder_name}</span>
                    </div>
                  )}
                  {workflow.cloned_at && (
                    <div className="flex items-center space-x-2">
                      <span>📅</span>
                      <span>Activated {new Date(workflow.cloned_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                <div className="flex space-x-2">
                  <button 
                    onClick={() => workflow.active ? handleDeactivateWorkflow(workflow.id) : handleActivateWorkflow(workflow.id)}
                    disabled={activating === workflow.id}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition text-sm font-medium disabled:opacity-50"
                  >
                    {activating === workflow.id ? 'Loading...' : workflow.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <a
                    href={`${process.env.REACT_APP_N8N_URL || 'http://localhost:5678'}/workflow/${workflow.n8n_workflow_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition text-sm font-medium text-center"
                  >
                    Open in n8n
                  </a>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

export default AutomationsLibrary
