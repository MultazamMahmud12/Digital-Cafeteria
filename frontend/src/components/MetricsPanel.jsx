import { useState, useEffect } from 'react'
import { Activity, TrendingUp, Zap, Clock } from 'lucide-react'
import { getMetrics } from '../utils/api'

export default function MetricsPanel({ services }) {
  const [serviceMetrics, setServiceMetrics] = useState({})
  const [metricsHistory, setMetricsHistory] = useState({})

  // Fetch real metrics from services
  useEffect(() => {
    const fetchMetrics = async () => {
      const newMetrics = {}
      
      for (const service of services) {
        try {
          const metricsUrl = (service.name === 'Identity' || service.name === 'Gateway') 
            ? `${service.url}/metrics/json` 
            : `${service.url}/metrics`
          
          const data = await getMetrics(metricsUrl)
          if (data) {
            newMetrics[service.name] = data
            
            // Track history
            const timestamp = new Date().toLocaleTimeString()
            const latency = data.avg_http_latency_ms || data.avg_job_latency_ms || 0
            
            setMetricsHistory(prev => {
              const serviceHistory = prev[service.name] || []
              const updated = [...serviceHistory, { time: timestamp, latency: Math.round(latency) }]
              return {
                ...prev,
                [service.name]: updated.slice(-20) // Keep last 20 points
              }
            })
          }
        } catch (error) {
          // Service unreachable
        }
      }
      
      setServiceMetrics(newMetrics)
    }

    fetchMetrics()
    const interval = setInterval(fetchMetrics, 3000)
    return () => clearInterval(interval)
  }, [services])

  // Calculate aggregate metrics
  const aggregateMetrics = () => {
    let totalRequests = 0
    let totalLatency = 0
    let totalFailures = 0
    let serviceCount = 0

    Object.values(serviceMetrics).forEach(metrics => {
      const requests = metrics.http_requests_total || metrics.jobs_processed_total || 0
      const failures = metrics.http_failures_total || metrics.jobs_failed_total || 0
      const latency = metrics.avg_http_latency_ms || metrics.avg_job_latency_ms || 0

      totalRequests += requests
      totalFailures += failures
      if (latency > 0) {
        totalLatency += latency
        serviceCount++
      }
    })

    return {
      totalRequests,
      avgLatency: serviceCount > 0 ? Math.round(totalLatency / serviceCount) : 0,
      errorRate: totalRequests > 0 ? ((totalFailures / totalRequests) * 100).toFixed(2) : 0,
      throughput: totalRequests > 0 ? (totalRequests / 60).toFixed(1) : 0
    }
  }

  const metrics = aggregateMetrics()

  const metricsList = [
    {
      title: 'Total Requests',
      value: metrics.totalRequests,
      unit: 'req',
      color: 'blue',
      icon: Activity
    },
    {
      title: 'Avg Latency',
      value: metrics.avgLatency,
      unit: 'ms',
      color: 'purple',
      icon: Clock
    },
    {
      title: 'Throughput',
      value: metrics.throughput,
      unit: 'req/min',
      color: 'green',
      icon: TrendingUp
    },
    {
      title: 'Error Rate',
      value: metrics.errorRate,
      unit: '%',
      color: 'red',
      icon: Zap
    }
  ]

  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    purple: 'bg-purple-50 border-purple-200',
    green: 'bg-green-50 border-green-200',
    red: 'bg-red-50 border-red-200'
  }

  const textColorClasses = {
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    green: 'text-green-600',
    red: 'text-red-600'
  }

  // Render service-specific line chart
  const renderServiceChart = (serviceName) => {
    const history = metricsHistory[serviceName] || []
    if (history.length < 2) return null

    const width = 200
    const height = 60
    const max = Math.max(...history.map(h => h.latency), 1)
    const min = Math.min(...history.map(h => h.latency), 0)
    const range = max - min || 1

    const points = history.map((point, idx) => {
      const x = (idx / (history.length - 1)) * width
      const y = height - ((point.latency - min) / range) * height
      return `${x},${y}`
    }).join(' ')

    return (
      <div className="mt-3 bg-slate-50 rounded p-3">
        <div className="text-xs text-slate-600 mb-2">Latency Trend (Last 20 samples)</div>
        <svg width={width} height={height} className="mx-auto">
          <polyline
            points={points}
            fill="none"
            stroke="rgb(59, 130, 246)"
            strokeWidth="2"
          />
          <text x={width - 5} y={15} textAnchor="end" fontSize="10" fill="#64748b">
            {max}ms
          </text>
        </svg>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Aggregate System Metrics */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900">System Metrics</h3>
          <p className="text-sm text-slate-600 mt-1">Real-time performance indicators</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6">
          {metricsList.map(metric => {
            const Icon = metric.icon
            return (
              <div
                key={metric.title}
                className={`rounded-lg border-2 p-4 ${colorClasses[metric.color]}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-600 font-medium">{metric.title}</p>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className={`text-2xl font-bold ${textColorClasses[metric.color]}`}>
                        {metric.value}
                      </span>
                      <span className="text-xs text-slate-500">{metric.unit}</span>
                    </div>
                  </div>
                  <Icon className={`w-5 h-5 ${textColorClasses[metric.color]} opacity-50`} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Per-Service Detailed Metrics */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900">Service Performance Metrics</h3>
          <p className="text-sm text-slate-600 mt-1">Individual service metrics with trend graphs</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
          {services.map(service => {
            const metrics = serviceMetrics[service.name]
            const requests = metrics?.http_requests_total || metrics?.jobs_processed_total || 0
            const failures = metrics?.http_failures_total || metrics?.jobs_failed_total || 0
            const latency = metrics?.avg_http_latency_ms || metrics?.avg_job_latency_ms || 0
            const successRate = requests > 0 ? (((requests - failures) / requests) * 100).toFixed(1) : 100

            return (
              <div key={service.name} className="border-2 border-slate-200 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-3">{service.name}</h4>
                
                {metrics ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-600">Requests:</span>
                        <span className="text-sm font-semibold text-blue-600">{requests}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-600">Avg Latency:</span>
                        <span className={`text-sm font-semibold ${latency > 500 ? 'text-red-600' : 'text-green-600'}`}>
                          {Math.round(latency)}ms
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-600">Success Rate:</span>
                        <span className={`text-sm font-semibold ${successRate < 95 ? 'text-red-600' : 'text-green-600'}`}>
                          {successRate}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-600">Failures:</span>
                        <span className={`text-sm font-semibold ${failures > 0 ? 'text-red-600' : 'text-slate-600'}`}>
                          {failures}
                        </span>
                      </div>
                    </div>

                    {renderServiceChart(service.name)}
                  </>
                ) : (
                  <div className="text-center py-4 text-sm text-slate-500">
                    No metrics available
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
