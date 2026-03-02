import { AlertCircle, CheckCircle, Circle } from 'lucide-react'

export default function HealthGrid({ services, health }) {
  const getHealthStatus = (serviceName) => {
    return health[serviceName] || { healthy: null, message: 'Checking...' }
  }

  const getStatusIcon = (healthy) => {
    if (healthy === true) {
      return <CheckCircle className="w-8 h-8 text-green-600" />
    } else if (healthy === false) {
      return <AlertCircle className="w-8 h-8 text-red-600" />
    }
    return <Circle className="w-8 h-8 text-slate-400" />
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="border-b border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900">Microservice Health</h3>
        <p className="text-sm text-slate-600 mt-1">Real-time status indicators</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
        {services.map(service => {
          const status = getHealthStatus(service.name)
          const isHealthy = status.healthy === true
          const isUnhealthy = status.healthy === false

          return (
            <div
              key={service.name}
              className={`rounded-lg border-2 p-4 transition-colors ${
                isHealthy
                  ? 'border-green-200 bg-green-50'
                  : isUnhealthy
                  ? 'border-red-200 bg-red-50'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {getStatusIcon(status.healthy)}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-900">{service.name}</h4>
                  <p className={`text-xs ${
                    isHealthy
                      ? 'text-green-700'
                      : isUnhealthy
                      ? 'text-red-700'
                      : 'text-slate-600'
                  }`}>
                    {isHealthy
                      ? 'Healthy'
                      : isUnhealthy
                      ? 'Unhealthy'
                      : 'Checking...'}
                  </p>
                  {status.message && (
                    <p className="text-xs text-slate-500 mt-1">{status.message}</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
