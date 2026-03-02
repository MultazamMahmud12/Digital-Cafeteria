import { useState, useEffect } from 'react'
import { Activity, TrendingUp } from 'lucide-react'

export default function MetricsPanel({ services }) {
  const [metrics, setMetrics] = useState({
    totalRequests: 42,
    avgLatency: 123,
    throughput: 18,
    errorRate: 0.02
  })

  // Simulate metrics updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        totalRequests: prev.totalRequests + Math.floor(Math.random() * 5),
        avgLatency: Math.max(50, prev.avgLatency + (Math.random() - 0.5) * 30),
        throughput: Math.max(0, prev.throughput + (Math.random() - 0.4) * 3),
        errorRate: Math.max(0, Math.min(1, prev.errorRate + (Math.random() - 0.5) * 0.01))
      }))
    }, 3000)

    return () => clearInterval(interval)
  }, [])

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
      value: Math.round(metrics.avgLatency),
      unit: 'ms',
      color: 'purple',
      icon: TrendingUp
    },
    {
      title: 'Throughput',
      value: metrics.throughput.toFixed(1),
      unit: 'req/s',
      color: 'green',
      icon: Activity
    },
    {
      title: 'Error Rate',
      value: (metrics.errorRate * 100).toFixed(2),
      unit: '%',
      color: 'red',
      icon: Activity
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

  return (
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
  )
}
