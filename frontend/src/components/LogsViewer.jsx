import { useState, useEffect, useRef } from 'react'
import { Terminal, AlertCircle } from 'lucide-react'
import { getServiceLogs } from '../utils/api'

export default function LogsViewer({ services }) {
  const [logs, setLogs] = useState({})
  const [selectedService, setSelectedService] = useState(services[0]?.name || '')
  const logRefs = useRef({})

  useEffect(() => {
    const fetchLogs = async () => {
      const newLogs = {}
      for (const service of services) {
        const result = await getServiceLogs(service.name, 50)
        newLogs[service.name] = result
      }
      setLogs(newLogs)
    }

    fetchLogs()
    const interval = setInterval(fetchLogs, 2000)
    return () => clearInterval(interval)
  }, [services])

  useEffect(() => {
    // Auto-scroll to bottom when logs update
    if (logRefs.current[selectedService]) {
      logRefs.current[selectedService].scrollTop = logRefs.current[selectedService].scrollHeight
    }
  }, [logs, selectedService])

  const currentLogs = logs[selectedService]?.logs || 'Loading logs...'
  const hasError = logs[selectedService]?.error

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="border-b border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-2">
          <Terminal className="w-5 h-5 text-slate-700" />
          <h3 className="text-lg font-bold text-slate-900">Service Logs</h3>
        </div>
        <p className="text-sm text-slate-600">Real-time container logs (updates every 2 seconds)</p>
      </div>

      <div className="p-6">
        {/* Service Selector */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {services.map(service => (
            <button
              key={service.name}
              onClick={() => setSelectedService(service.name)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedService === service.name
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {service.name}
            </button>
          ))}
        </div>

        {/* Log Display */}
        {hasError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-700">Failed to fetch logs</p>
              <p className="text-sm text-red-600 mt-1">{logs[selectedService]?.error}</p>
            </div>
          </div>
        ) : (
          <div
            ref={(el) => (logRefs.current[selectedService] = el)}
            className="bg-slate-900 text-slate-100 rounded-lg p-4 overflow-auto font-mono text-xs leading-relaxed"
            style={{ maxHeight: '400px', whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}
          >
            {currentLogs || 'No logs available'}
          </div>
        )}
      </div>
    </div>
  )
}
