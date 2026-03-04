import { useState, useContext, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import { checkServiceHealth, killService, startService, getMetrics } from '../utils/api'
import Header from '../components/Header'
import HealthGrid from '../components/HealthGrid'
import MetricsPanel from '../components/MetricsPanel'
import LogsViewer from '../components/LogsViewer'
import QueueMonitor from '../components/QueueMonitor'
import { AlertCircle, RefreshCw, Zap, Play } from 'lucide-react'

export default function AdminDashboard() {
  const GATEWAY_ALERT_THRESHOLD_MS = 1000
  const GATEWAY_ALERT_WINDOW_MS = 30000

  const [health, setHealth] = useState({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedService, setSelectedService] = useState(null)
  const [chaosLoading, setChaosLoading] = useState(false)
  const [chaosConfirm, setChaosConfirm] = useState(false)
  const [startLoading, setStartLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [gatewayAlertVisible, setGatewayAlertVisible] = useState(false)

  const gatewaySamplesRef = useRef([])

  const { handleLogout, config } = useContext(AuthContext)
  const navigate = useNavigate()

  const servicesList = useMemo(
    () => [
      { name: 'Identity', url: config?.identityBaseUrl },
      { name: 'Gateway', url: config?.gatewayBaseUrl },
      { name: 'Stock', url: config?.stockBaseUrl || config?.services?.find(s => s.name === 'Stock')?.url },
      { name: 'Kitchen', url: config?.kitchenBaseUrl || config?.services?.find(s => s.name === 'Kitchen')?.url },
      { name: 'Notification', url: config?.notificationBaseUrl || config?.services?.find(s => s.name === 'Notification')?.url }
    ].filter(s => s.url),
    [config]
  )

  const checkAllHealth = async () => {
    const currentHealth = { ...health } // Capture current state before checking
    const results = {}
    
    for (const service of servicesList) {
      try {
        const result = await checkServiceHealth(service.url)
        const wasUnhealthy = currentHealth[service.name]?.healthy === false
        const isNowHealthy = result.healthy
        
        // Detect recovery after restart
        if (wasUnhealthy && isNowHealthy) {
          setErrorMessage(`✅ ${service.name} service recovered and is now healthy`)
          setTimeout(() => setErrorMessage(''), 5000)
        }
        
        results[service.name] = result
      } catch (err) {
        const wasHealthy = currentHealth[service.name]?.healthy !== false
        if (wasHealthy) {
          setErrorMessage(`⚠️ ${service.name} service is restarting...`)
        }
        results[service.name] = { healthy: false, message: 'Restarting or down' }
      }
    }
    
    setHealth(results)
  }

  useEffect(() => {
    const loadHealth = async () => {
      setLoading(true)
      await checkAllHealth()
      setLoading(false)
    }

    loadHealth()
    const interval = setInterval(checkAllHealth, 500) // Auto-refresh every 500ms to catch rapid restarts
    return () => clearInterval(interval)
  }, [config])

  useEffect(() => {
    const gatewayService = servicesList.find((service) => service.name === 'Gateway')

    if (!gatewayService?.url) {
      setGatewayAlertVisible(false)
      gatewaySamplesRef.current = []
      return
    }

    const pollGatewayLatency = async () => {
      const now = Date.now()
      const cutoff = now - GATEWAY_ALERT_WINDOW_MS
      gatewaySamplesRef.current = gatewaySamplesRef.current.filter((entry) => entry.at >= cutoff)

      const metricsUrl = `${gatewayService.url}/metrics/json`
      const metrics = await getMetrics(metricsUrl)
      const sample = Number(metrics?.avg_http_latency_ms)

      if (!Number.isFinite(sample)) {
        if (gatewaySamplesRef.current.length === 0) {
          setGatewayAlertVisible(false)
        }
        return
      }

      gatewaySamplesRef.current.push({ at: now, value: sample })
      gatewaySamplesRef.current = gatewaySamplesRef.current.filter((entry) => entry.at >= cutoff)

      if (gatewaySamplesRef.current.length === 0) {
        setGatewayAlertVisible(false)
        return
      }

      const avgLatency =
        gatewaySamplesRef.current.reduce((total, entry) => total + entry.value, 0) /
        gatewaySamplesRef.current.length

      setGatewayAlertVisible(avgLatency > GATEWAY_ALERT_THRESHOLD_MS)
    }

    pollGatewayLatency()
    const interval = setInterval(pollGatewayLatency, 2000)
    return () => clearInterval(interval)
  }, [servicesList])

  const handleRefresh = async () => {
    setRefreshing(true)
    await checkAllHealth()
    setRefreshing(false)
  }

  const handleChaosToggle = async (serviceName) => {
    setSelectedService(serviceName)
    setChaosConfirm(true)
    setErrorMessage('')
  }

  const confirmChaos = async () => {
    setChaosLoading(true)
    try {
      const service = servicesList.find(s => s.name === selectedService)
      if (!service) throw new Error('Service not found')

      await killService(service.url)
      setErrorMessage(`⚡ ${selectedService} has been terminated. Observing system resilience...`)
      
      // Refresh health after a moment
      setTimeout(() => {
        checkAllHealth()
      }, 2000)
    } catch (err) {
      setErrorMessage(`Failed to trigger chaos for ${selectedService}: ${err.message}`)
    } finally {
      setChaosLoading(false)
      setChaosConfirm(false)
    }
  }

  const handleStartService = async (serviceName) => {
    setStartLoading(true)
    setErrorMessage('')
    try {
      await startService(serviceName)
      setErrorMessage(`🚀 ${serviceName} is starting... Waiting for health check...`)
      
      // Refresh health after a moment
      setTimeout(() => {
        checkAllHealth()
      }, 3000)
    } catch (err) {
      setErrorMessage(`❌ Failed to start ${serviceName}: ${err.message}`)
    } finally {
      setStartLoading(false)
    }
  }

  const handleLogoutClick = () => {
    handleLogout()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header 
        onLogout={handleLogoutClick}
        isAdmin={true}
      />
      
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <div className="grid gap-6">
          {/* Header with Refresh */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">System Health Monitor</h2>
              <p className="text-slate-600 mt-1">Real-time microservice status and metrics</p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">{errorMessage}</p>
            </div>
          )}

          {gatewayAlertVisible && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">
                Gateway latency alert: average response time is above 1000ms over the last 30 seconds.
              </p>
            </div>
          )}

          {/* Health Grid */}
          {loading ? (
            <div className="bg-white rounded-lg shadow p-12 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
                <p className="text-slate-600">Loading service health...</p>
              </div>
            </div>
          ) : (
            <HealthGrid services={servicesList} health={health} />
          )}

          {/* Metrics Panel */}
          <MetricsPanel services={servicesList} />

          {/* RabbitMQ Queue Monitor */}
          <QueueMonitor />

          {/* Chaos Control Section */}
          <div className="bg-white rounded-lg shadow">
            <div className="border-b border-slate-200 p-6 bg-gradient-to-r from-red-50 to-orange-50">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-orange-600" />
                <h3 className="text-lg font-bold text-slate-900">Chaos Engineering</h3>
              </div>
              <p className="text-sm text-slate-600">Manually terminate or restart services to observe system resilience</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 gap-4">
                {servicesList.map(service => (
                  <div key={service.name} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <span className="font-medium text-slate-900 min-w-[120px]">{service.name}</span>
                    <button
                      onClick={() => handleChaosToggle(service.name)}
                      disabled={chaosLoading || startLoading}
                      className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                      Kill {service.name}
                    </button>
                    <button
                      onClick={() => handleStartService(service.name)}
                      disabled={chaosLoading || startLoading}
                      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Start {service.name}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Logs Viewer */}
          <LogsViewer services={servicesList} />
        </div>
      </div>

      {/* Chaos Confirmation Modal */}
      {chaosConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Confirm Chaos</h3>
            <p className="text-slate-600 mb-6">
              Terminate <strong>{selectedService}</strong>? This service will be stopped and you can observe how the system handles the failure.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setChaosConfirm(false)}
                disabled={chaosLoading}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmChaos}
                disabled={chaosLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {chaosLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                Confirm Kill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
