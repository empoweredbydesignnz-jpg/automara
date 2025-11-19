import React, { useState } from 'react'

function SignupPage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    companyName: '',
    domain: '',
    tenantType: 'client',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    industry: '',
    teamSize: '',
    agreeToTerms: false
  })

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    })
  }

  const handleNext = () => {
    setError('')
    
    if (step === 1) {
      if (!formData.companyName || !formData.domain) {
        setError('Please fill in all company details')
        return
      }
    } else if (step === 2) {
      if (!formData.firstName || !formData.lastName || !formData.email) {
        setError('Please fill in all personal details')
        return
      }
      if (!/\S+@\S+\.\S+/.test(formData.email)) {
        setError('Please enter a valid email address')
        return
      }
    } else if (step === 3) {
      if (!formData.password || !formData.confirmPassword) {
        setError('Please enter and confirm your password')
        return
      }
      if (formData.password.length < 8) {
        setError('Password must be at least 8 characters')
        return
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match')
        return
      }
    }
    
    setStep(step + 1)
  }

  const handleBack = () => {
    setError('')
    setStep(step - 1)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    if (!formData.agreeToTerms) {
      setError('Please agree to the terms and conditions')
      return
    }
    
    setLoading(true)
    
    try {
      const response = await fetch('/api/tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.companyName,
          domain: formData.domain + '.automara.com',
          owner_email: formData.email,
          owner_first_name: formData.firstName,
          owner_last_name: formData.lastName,
          tenant_type: formData.tenantType,
        }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        alert('Account created successfully! Please login.')
        window.location.href = '/login'
      } else {
        setError(data.error || 'Failed to create account')
        setLoading(false)
      }
    } catch (error) {
      console.error('Signup error:', error)
      setError('Failed to create account. Please try again.')
      setLoading(false)
    }
  }

  const progressPercentage = (step / 4) * 100

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4">
      <div className="max-w-2xl w-full relative z-10">
        <div className="bg-gray-800 bg-opacity-50 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-gray-700">
          
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Join Automara</h1>
            <p className="text-gray-400">Create your multi-tenant workspace</p>
          </div>

          <div className="mb-8">
            <div className="flex justify-between mb-2">
              {['Company', 'Personal', 'Security', 'Finish'].map((label, index) => (
                <div key={index} className={`text-sm font-medium ${step > index ? 'text-purple-400' : step === index + 1 ? 'text-white' : 'text-gray-500'}`}>
                  {label}
                </div>
              ))}
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full transition-all duration-500"
                style={{ width: progressPercentage + '%' }}
              ></div>
            </div>
          </div>

          {error && (
            <div className="mb-6 bg-red-500 bg-opacity-10 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            
            {step === 1 && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-white mb-4">Company Information</h2>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Company Name</label>
                  <input
                    type="text"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    placeholder="Acme Corporation"
                    className="w-full px-4 py-3 bg-gray-900 bg-opacity-50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Subdomain</label>
                  <div className="flex items-center">
                    <input
                      type="text"
                      name="domain"
                      value={formData.domain}
                      onChange={handleChange}
                      placeholder="mycompany"
                      className="flex-1 px-4 py-3 bg-gray-900 bg-opacity-50 border border-gray-600 rounded-l-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="px-4 py-3 bg-gray-700 border border-l-0 border-gray-600 rounded-r-lg text-gray-400">.automara.com</span>
                   </div>
                  </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Account Type
                  </label>
                  <select
                    name="tenantType"
                    value={formData.tenantType}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-900 bg-opacity-50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="client">Single Business Entity</option>
                    <option value="msp">Managed Service Provider (MSP)</option>
                  </select>
                  <p className="text-gray-400 text-xs mt-1">
                    MSPs can manage multiple client organizations
                  </p>
                </div>
              </div>

              
            )}

            {step === 2 && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-white mb-4">Personal Information</h2>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">First Name</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      placeholder="John"
                      className="w-full px-4 py-3 bg-gray-900 bg-opacity-50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Last Name</label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      placeholder="Doe"
                      className="w-full px-4 py-3 bg-gray-900 bg-opacity-50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="john@company.com"
                    className="w-full px-4 py-3 bg-gray-900 bg-opacity-50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-white mb-4">Create Your Account</h2>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-gray-900 bg-opacity-50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-gray-900 bg-opacity-50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-white mb-4">Almost There!</h2>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Industry</label>
                  <select
                    name="industry"
                    value={formData.industry}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-900 bg-opacity-50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select your industry</option>
                    <option value="technology">Technology</option>
                    <option value="finance">Finance</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="retail">Retail</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="bg-gray-900 bg-opacity-50 rounded-lg p-4 border border-gray-600">
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="agreeToTerms"
                      checked={formData.agreeToTerms}
                      onChange={handleChange}
                      className="mt-1 w-5 h-5 rounded border-gray-600 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-300">
                      I agree to the Terms of Service and Privacy Policy
                    </span>
                  </label>
                </div>
              </div>
            )}

            <div className="flex justify-between mt-8">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition"
                >
                  Back
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => window.location.href = '/login'}
                  className="text-gray-400 hover:text-white font-medium py-3 px-6 transition"
                >
                  Back to Login
                </button>
              )}

              {step < 4 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-purple-700 hover:to-pink-700 transition"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-purple-700 hover:to-pink-700 transition disabled:opacity-50 flex items-center space-x-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Account</span>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>

        <p className="text-center text-gray-500 text-sm mt-8">
          Empowered by Design © 2025
        </p>
      </div>
    </div>
  )
}

export default SignupPage
