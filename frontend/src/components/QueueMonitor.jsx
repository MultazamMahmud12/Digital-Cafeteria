import { useState, useEffect } from 'react'
import { Layers, Circle, AlertCircle } from 'lucide-react'
import { getRabbitMQQueues } from '../utils/api'

export default function QueueMonitor() {
  const [queueData, setQueueData] = useState({ queues: [], error: null })

  useEffect(() => {
    const fetchQueues = async () => {
      const data = await getRabbitMQQueues()
      setQueueData(data)
    }

    fetchQueues()
    const interval = setInterval(fetchQueues, 2000)
    return () => clearInterval(interval)
  }, [])

  if (queueData.error) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-slate-200 p-6">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-slate-700" />
            <h3 className="text-lg font-bold text-slate-900">RabbitMQ Queue Status</h3>
          </div>
        </div>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-700">Unable to fetch queue data</p>
              <p className="text-sm text-red-600 mt-1">{queueData.error}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="border-b border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-5 h-5 text-slate-700" />
          <h3 className="text-lg font-bold text-slate-900">RabbitMQ Queue Status</h3>
        </div>
        <p className="text-sm text-slate-600">Real-time message queue monitoring</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
        {queueData.queues.length > 0 ? (
          queueData.queues.map(queue => (
            <div
              key={queue.name}
              className="rounded-lg border-2 border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <h4 className="font-semibold text-slate-900">{queue.name}</h4>
                <div className="flex items-center gap-1">
                  <Circle
                    className={`w-3 h-3 ${
                      queue.state === 'running' ? 'text-green-600 fill-green-600' : 'text-red-600 fill-red-600'
                    }`}
                  />
                  <span className="text-xs text-slate-600">{queue.state}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Total Messages:</span>
                  <span className="text-sm font-semibold text-slate-900">{queue.messages}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Ready:</span>
                  <span className="text-sm font-semibold text-blue-600">{queue.messages_ready}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Unacknowledged:</span>
                  <span className="text-sm font-semibold text-amber-600">{queue.messages_unacknowledged}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Consumers:</span>
                  <span className={`text-sm font-semibold ${queue.consumers > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {queue.consumers}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-2 text-center py-8 text-slate-600">
            No queue data available
          </div>
        )}
      </div>
    </div>
  )
}
