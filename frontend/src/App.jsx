import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import LoginPage from './pages/LoginPage'
import StudentDashboard from './pages/StudentDashboard'
import AdminDashboard from './pages/AdminDashboard'
import { AuthContext } from './context/AuthContext'
import { fetchConfig } from './utils/api'

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadConfig = async () => {
      try {
        console.log('Fetching config from:', window.location.origin + '/api/config')
        const configData = await fetchConfig()
        console.log('Config loaded:', configData)
        if (!configData?.identityBaseUrl) {
          console.warn('Missing identityBaseUrl in config:', configData)
        }
        setConfig(configData)
      } catch (error) {
        console.error('Failed to load config:', error)
        console.error('Make sure the frontend server is running on port 8085 with /api/config endpoint')
        setConfig({
          identityBaseUrl: 'http://localhost:8081',
          identityLoginPath: '/auth/login',
          gatewayBaseUrl: 'http://localhost:8090',
          gatewayOrderPath: '/orders',
          services: []
        })
      } finally {
        setLoading(false)
      }
    }

    loadConfig()
  }, [])

  const handleLogin = (newToken) => {
    setToken(newToken)
    localStorage.setItem('token', newToken)
  }

  const handleLogout = () => {
    setToken(null)
    localStorage.removeItem('token')
  }

  if (loading || !config) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ token, config, handleLogin, handleLogout }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={token ? <Navigate to="/student" /> : <LoginPage />} />
          <Route path="/student" element={token ? <StudentDashboard /> : <Navigate to="/" />} />
          <Route path="/admin" element={token ? <AdminDashboard /> : <Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}

export default App
