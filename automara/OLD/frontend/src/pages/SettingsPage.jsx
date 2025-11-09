import React, { useState } from 'react'

function SettingsPage({ user }) {
  const [activeTab, setActiveTab] = useState('profile')
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || ''
  })
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const tabs = [
    { id: 'profile', name: 'Profile', icon: '👤' },
    { id: 'security', name: 'Security', icon: '🔒' },
    { id: 'notifications', name: 'Notifications', icon: '🔔' },
    ...(user?.role === 'admin' ? [{ id: 'users', name: 'Users', icon: '👥' }] : []),
  ]

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setLoading(true)
    setSuccessMessage('')
    
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    console.log('Saving profile:', profile)
    setLoading(false)
    setSuccessMessage('Profile updated successfully!')
    
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-400">Manage your account settings and preferences</p>
      </div>

      {successMessage && (
        <div className="mb-6 bg-green-500 bg-opacity-10 border border-green-500 text-green-400 px-4 py-3 rounded-lg flex items-center space-x-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>{successMessage}</span>
        </div>
      )}

      <div className="flex gap-6">
        <div className="w-64 bg-gray-800 rounded-xl p-4 border border-gray-700 h-fit">
          <div className="space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                  activeTab === tab.id
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <span className="text-xl">{tab.icon}</span>
                <span className="font-medium">{tab.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1">
          {activeTab === 'profile' && (
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-6">Profile Settings</h2>
              
              <form onSubmit={handleSaveProfile} className="space-y-6">
                <div className="flex items-center space-x-6 mb-8">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                    {profile.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <button type="button" className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition text-sm font-medium">
                      Change Avatar
                    </button>
                    <p className="text-sm text-gray-400 mt-2">JPG, GIF or PNG. Max size 2MB</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      disabled={loading}
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                      disabled={loading}
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Role
                    </label>
                    <input
                      type="text"
                      value={profile.role}
                      disabled
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-gray-500 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-2">Contact admin to change your role</p>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    disabled={loading}
                    className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-6 rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-2 px-6 rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
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
              </form>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-6">Security Settings</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Change Password</h3>
                  <div className="space-y-4">
                    <input
                      type="password"
                      placeholder="Current Password"
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <input
                      type="password"
                      placeholder="New Password"
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <input
                      type="password"
                      placeholder="Confirm New Password"
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <button className="mt-4 bg-purple-600 hover:bg-purple-700 text-white py-2 px-6 rounded-lg transition font-medium">
                    Update Password
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-6">Notification Preferences</h2>
              
              <div className="space-y-4">
                {[
                  { title: 'Email Notifications', description: 'Receive email updates about your account' },
                  { title: 'Workflow Alerts', description: 'Get notified when workflows complete or fail' },
                  { title: 'Security Alerts', description: 'Important security updates and warnings' },
                ].map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-900 bg-opacity-50 rounded-lg">
                    <div>
                      <div className="text-white font-medium">{item.title}</div>
                      <div className="text-sm text-gray-400">{item.description}</div>
                    </div>
                    <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-purple-600">
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-6" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'users' && user?.role === 'admin' && (
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-6">User Management</h2>
              
              <div className="space-y-4">
                <p className="text-gray-400 mb-4">Manage user roles and permissions</p>
                
                <div className="bg-gray-900 bg-opacity-50 rounded-lg p-4 border border-gray-600">
                  <h3 className="text-lg font-semibold text-white mb-4">Current Admin</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">{user.email}</div>
                      <div className="text-sm text-gray-400">Role: Administrator</div>
                    </div>
                    <span className="px-3 py-1 bg-purple-600 text-white rounded-full text-xs font-semibold">
                      ADMIN
                    </span>
                  </div>
                </div>

                <div className="bg-blue-500 bg-opacity-10 border border-blue-500 text-blue-400 px-4 py-3 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <svg className="w-5 h-5 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <div className="font-semibold mb-1">Role Information</div>
                      <div className="text-sm">
                        <strong>Admin:</strong> Full access to all tenants and settings<br/>
                        <strong>Client:</strong> Access only to their own tenant data
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
