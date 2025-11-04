import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import axios from 'axios'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import Dashboard from './pages/Dashboard'
import TenantsPage from './pages/TenantsPage'
import SettingsPage from './pages/SettingsPage'
import Layout from './components/Layout'
import UsersPage from './pages/UsersPage'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [currentTenant, setCurrentTenant] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    const storedTenant = localStorage.getItem('currentTenant')
    
    if (storedUser) {
      setUser(JSON.parse(storedUser))
      setIsAuthenticated(true)
      if (storedTenant) {
        setCurrentTenant(JSON.parse(storedTenant))
      }
    }
    setLoading(false)
  }, [])

  const handleLogin = async (email, password, tenantDomain) => {
    try {
      const response = await axios.post('/api/auth/login', {
        email,
        password,
        tenantDomain
      });

      if (!response.data.success) {
        return {
          success: false,
          message: response.data.error
        };
      }

      const userData = {
        id: response.data.user.id,
        email: response.data.user.email,
        name: response.data.user.first_name || response.data.user.email.split('@')[0],
        role: response.data.user.role,
        tenantId: response.data.user.tenant_id
      };

      const tenantData = response.data.isAdmin ? null : {
        id: response.data.tenant.id,
        name: response.data.tenant.name,
        domain: response.data.tenant.domain,
        status: response.data.tenant.status
      };

      setUser(userData);
      setCurrentTenant(tenantData);
      setIsAuthenticated(true);
      
      localStorage.setItem('user', JSON.stringify(userData));
      if (tenantData) {
        localStorage.setItem('currentTenant', JSON.stringify(tenantData));
      }
      
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      
      if (error.response?.data?.suspended) {
        return {
          success: false,
          suspended: true,
          message: 'This account has been suspended. Please contact support.'
        };
      }
      
      return { 
        success: false, 
        message: error.response?.data?.error || 'Login failed. Please try again.' 
      };
    }
  };

  const handleLogout = () => {
    setUser(null)
    setCurrentTenant(null)
    setIsAuthenticated(false)
    localStorage.removeItem('user')
    localStorage.removeItem('currentTenant')
  }

  const switchTenant = (tenant) => {
    setCurrentTenant(tenant)
    localStorage.setItem('currentTenant', JSON.stringify(tenant))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={
            isAuthenticated ? 
              <Navigate to="/dashboard" /> : 
              <LoginPage onLogin={handleLogin} />
          } 
        />
        
        <Route 
          path="/signup" 
          element={
            isAuthenticated ? 
              <Navigate to="/dashboard" /> : 
              <SignupPage />
          } 
        />
        
        <Route
          path="/*"
          element={
            isAuthenticated ? (
              <Layout 
                user={user} 
                currentTenant={currentTenant}
                onLogout={handleLogout}
                onSwitchTenant={switchTenant}
              >
                <Routes>
                  <Route path="/dashboard" element={<Dashboard tenant={currentTenant} />} />
                  <Route path="/tenants" element={<TenantsPage />} />
		  <Route path="/users" element={<UsersPage />} />
                  <Route path="/settings" element={<SettingsPage user={user} />} />
                  <Route path="/" element={<Navigate to="/dashboard" />} />
                </Routes>
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </Router>
  )
}

export default App
