import React, { useState } from 'react';
import { useTheme, themes } from '../context/ThemeContext';

function SettingsPage({ user }) {
  const [activeTab, setActiveTab] = useState('profile');
  const { currentTheme, setCurrentTheme, darkMode, setDarkMode } = useTheme();
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || ''
  });
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const tabs = [
    {
      id: 'profile',
      name: 'Profile',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    },
    {
      id: 'appearance',
      name: 'Appearance',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      )
    },
    {
      id: 'security',
      name: 'Security',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      )
    },
    { 
      id: 'notifications', 
      name: 'Notifications', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      )
    },
    ...(user?.role === 'admin' ? [{ 
      id: 'users', 
      name: 'Users', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )
    }] : []),
  ];

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage('');
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log('Saving profile:', profile);
    setLoading(false);
    setSuccessMessage('Profile updated successfully!');
    
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  const handleThemeChange = (themeKey) => {
    setCurrentTheme(themeKey);
    setSuccessMessage('Theme updated successfully!');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-theme-accent via-theme-accent-alt to-theme-accent bg-clip-text text-transparent mb-3">
            Settings
          </h1>
          <p className="text-slate-400 text-lg">Manage your account settings and preferences</p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-6 py-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:w-72">
            <div className="bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-2xl border border-slate-800 p-4 sticky top-8">
              <div className="space-y-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-theme-primary-dark to-theme-secondary-dark text-white shadow-lg shadow-theme-primary/25'
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                      activeTab === tab.id
                        ? 'bg-white/20'
                        : 'bg-slate-800/50'
                    }`}>
                      {tab.icon}
                    </div>
                    <span className="font-semibold">{tab.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-2xl border border-slate-800 p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-gradient-to-br from-theme-primary-dark/20 to-theme-secondary-dark/20 rounded-lg flex items-center justify-center border border-theme-primary/20">
                    <svg className="w-5 h-5 text-theme-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h2 className="text-3xl font-bold text-white">Profile Settings</h2>
                </div>
                
                <form onSubmit={handleSaveProfile} className="space-y-8">
                  {/* Avatar Section */}
                  <div className="flex items-center gap-6 p-6 bg-slate-900/50 rounded-xl border border-slate-800">
                    <div className="relative">
                      <div className="w-24 h-24 bg-gradient-to-br from-theme-primary-dark to-theme-secondary-dark rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-xl shadow-theme-primary/25">
                        {getInitials(profile.name)}
                      </div>
                      <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-400 rounded-lg flex items-center justify-center border-4 border-slate-900">
                        <svg className="w-4 h-4 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <button 
                        type="button" 
                        className="px-6 py-3 bg-theme-primary/10 text-theme-accent border border-theme-primary/20 rounded-xl font-semibold transition-all hover:bg-theme-primary/20 flex items-center gap-2 mb-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Change Avatar
                      </button>
                      <p className="text-sm text-slate-400">JPG, GIF or PNG. Max size 2MB</p>
                    </div>
                  </div>

                  {/* Form Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={profile.name}
                        onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                        disabled={loading}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={profile.email}
                        onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                        disabled={loading}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                        Role
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={profile.role}
                          disabled
                          className="w-full px-4 py-3 bg-slate-900/30 border border-slate-800 rounded-xl text-slate-500 cursor-not-allowed"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-2 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Contact admin to change your role
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 pt-6 border-t border-slate-800">
                    <button
                      type="button"
                      disabled={loading}
                      className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-3 bg-gradient-to-r from-theme-primary-dark to-theme-secondary-dark hover:from-theme-primary hover:to-theme-secondary rounded-xl font-semibold shadow-lg shadow-theme-primary/25 hover:shadow-theme-primary/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {loading ? (
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
                </form>
              </div>
            )}

            {/* Appearance Tab */}
            {activeTab === 'appearance' && (
              <div className="bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-2xl border border-slate-800 p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-gradient-to-br from-theme-primary-dark/20 to-theme-secondary-dark/20 rounded-lg flex items-center justify-center border border-theme-primary/20">
                    <svg className="w-5 h-5 text-theme-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                  </div>
                  <h2 className="text-3xl font-bold text-white">Appearance</h2>
                </div>

                <div className="space-y-8">
                  {/* Dark/Light Mode Toggle */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Mode</h3>
                    <p className="text-slate-400 mb-6">Switch between dark and light mode</p>

                    <div className="flex items-center justify-between p-6 bg-slate-900/50 rounded-xl border border-slate-800">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-theme-primary-dark/20 to-theme-secondary-dark/20 rounded-xl flex items-center justify-center border border-theme-primary/20">
                          {darkMode ? (
                            <svg className="w-6 h-6 text-theme-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                            </svg>
                          ) : (
                            <svg className="w-6 h-6 text-theme-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <div className="text-white font-semibold text-lg mb-1">
                            {darkMode ? 'Dark Mode' : 'Light Mode'}
                          </div>
                          <div className="text-sm text-slate-400">
                            {darkMode ? 'Easy on the eyes in low light' : 'Bright and clear for daytime'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setDarkMode(!darkMode);
                          setSuccessMessage(`Switched to ${!darkMode ? 'dark' : 'light'} mode`);
                          setTimeout(() => setSuccessMessage(''), 3000);
                        }}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all ${
                          darkMode ? 'bg-gradient-to-r from-theme-primary-dark to-theme-secondary-dark' : 'bg-slate-600'
                        }`}
                      >
                        <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-lg ${
                          darkMode ? 'translate-x-7' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  </div>

                  {/* Color Theme Selection */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Color Theme</h3>
                    <p className="text-slate-400 mb-6">Select a color theme for the interface</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(themes).map(([key, theme]) => (
                        <button
                          key={key}
                          onClick={() => handleThemeChange(key)}
                          className={`group relative p-4 rounded-xl border-2 transition-all duration-300 ${
                            currentTheme === key
                              ? 'border-purple-500 bg-theme-primary/10'
                              : 'border-slate-700 hover:border-slate-600 bg-slate-900/50'
                          }`}
                        >
                          {currentTheme === key && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-theme-primary rounded-full flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}

                          {/* Color Preview */}
                          <div className="flex gap-2 mb-3">
                            <div
                              className="w-8 h-8 rounded-lg"
                              style={{ backgroundColor: `rgb(${theme.colors.primary})` }}
                            />
                            <div
                              className="w-8 h-8 rounded-lg"
                              style={{ backgroundColor: `rgb(${theme.colors.secondary})` }}
                            />
                            <div
                              className="w-8 h-8 rounded-lg"
                              style={{ backgroundColor: `rgb(${theme.colors.accent})` }}
                            />
                          </div>

                          <div className="text-left">
                            <div className="font-semibold text-white mb-1">{theme.name}</div>
                            <div className="text-sm text-slate-400">{theme.description}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-2xl border border-slate-800 p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-gradient-to-br from-red-600/20 to-orange-600/20 rounded-lg flex items-center justify-center border border-red-500/20">
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h2 className="text-3xl font-bold text-white">Security Settings</h2>
                </div>
                
                <div className="space-y-6">
                  <div className="p-6 bg-slate-900/50 rounded-xl border border-slate-800">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                      <svg className="w-5 h-5 text-theme-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Change Password
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                          Current Password
                        </label>
                        <input
                          type="password"
                          placeholder="Enter current password"
                          className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/20 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                          New Password
                        </label>
                        <input
                          type="password"
                          placeholder="Enter new password"
                          className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/20 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          placeholder="Confirm new password"
                          className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/20 transition-all"
                        />
                      </div>
                    </div>
                    <button className="mt-6 px-6 py-3 bg-gradient-to-r from-theme-primary-dark to-theme-secondary-dark hover:from-theme-primary hover:to-theme-secondary rounded-xl font-semibold shadow-lg shadow-theme-primary/25 hover:shadow-theme-primary/40 transition-all flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Update Password
                    </button>
                  </div>

                  {/* Two-Factor Authentication */}
                  <div className="p-6 bg-slate-900/50 rounded-xl border border-slate-800">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          Two-Factor Authentication
                        </h3>
                        <p className="text-sm text-slate-400">Add an extra layer of security to your account</p>
                      </div>
                      <div className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg text-xs font-bold">
                        Coming Soon
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-2xl border border-slate-800 p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 rounded-lg flex items-center justify-center border border-blue-500/20">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <h2 className="text-3xl font-bold text-white">Notification Preferences</h2>
                </div>
                
                <div className="space-y-4">
                  {[
                    { 
                      title: 'Email Notifications', 
                      description: 'Receive email updates about your account',
                      enabled: true,
                      icon: (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      )
                    },
                    { 
                      title: 'Workflow Alerts', 
                      description: 'Get notified when workflows complete or fail',
                      enabled: true,
                      icon: (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      )
                    },
                    { 
                      title: 'Security Alerts', 
                      description: 'Important security updates and warnings',
                      enabled: true,
                      icon: (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      )
                    },
                  ].map((item, index) => (
                    <div key={index} className="group flex items-center justify-between p-6 bg-slate-900/50 rounded-xl border border-slate-800 hover:border-slate-700 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-theme-primary-dark/20 to-theme-secondary-dark/20 rounded-xl flex items-center justify-center border border-theme-primary/20 text-theme-accent">
                          {item.icon}
                        </div>
                        <div>
                          <div className="text-white font-semibold text-lg mb-1">{item.title}</div>
                          <div className="text-sm text-slate-400">{item.description}</div>
                        </div>
                      </div>
                      <button className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all ${
                        item.enabled ? 'bg-gradient-to-r from-theme-primary-dark to-theme-secondary-dark' : 'bg-slate-700'
                      }`}>
                        <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-lg ${
                          item.enabled ? 'translate-x-7' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && user?.role === 'admin' && (
              <div className="bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-2xl border border-slate-800 p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-gradient-to-br from-theme-primary-dark/20 to-theme-secondary-dark/20 rounded-lg flex items-center justify-center border border-theme-primary/20">
                    <svg className="w-5 h-5 text-theme-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <h2 className="text-3xl font-bold text-white">User Management</h2>
                </div>
                
                <div className="space-y-6">
                  <p className="text-slate-400">Manage user roles and permissions</p>
                  
                  <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Current Admin
                    </h3>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-theme-primary-dark to-theme-secondary-dark rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-theme-primary/25">
                          {getInitials(user?.name || user?.email || 'A')}
                        </div>
                        <div>
                          <div className="text-white font-semibold">{user?.email}</div>
                          <div className="text-sm text-slate-400">Role: Administrator</div>
                        </div>
                      </div>
                      <span className="px-4 py-2 bg-theme-primary/10 text-theme-accent border border-theme-primary/20 rounded-lg text-sm font-bold">
                        ADMIN
                      </span>
                    </div>
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 p-6 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-bold mb-2 text-lg">Role Information</div>
                        <div className="text-sm space-y-1 text-blue-300">
                          <p><strong className="text-blue-200">Admin:</strong> Full access to all tenants and settings</p>
                          <p><strong className="text-blue-200">Client:</strong> Access only to their own tenant data</p>
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
    </div>
  );
}

export default SettingsPage;