import { useState, useContext, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import { placeOrder } from '../utils/api'
import Header from '../components/Header'
import OrderForm from '../components/OrderForm'
import OrderTracker from '../components/OrderTracker'
import { AlertCircle, CheckCircle, Loader } from 'lucide-react'

const STATUS_ORDER = {
  PENDING: 0,
  STOCK_VERIFIED: 1,
  IN_KITCHEN: 2,
  READY: 3
}

export default function StudentDashboard() {
  const [order, setOrder] = useState(null)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [ws, setWs] = useState(null)
  
  const { token, config, handleLogout } = useContext(AuthContext)
  const navigate = useNavigate()

  useEffect(() => {
    return () => {
      if (ws) ws.close()
    }
  }, [ws])

  const connectWebSocket = (orderId) => {
    if (ws) ws.close()

    const protocol = config.notificationWsUrl.startsWith('wss') ? 'wss' : 'ws'
    const wsUrl = `${config.notificationWsUrl}`
    
    const newWs = new WebSocket(wsUrl)
    let reconnectTimer = null

    newWs.onopen = () => {
      console.log('WebSocket connected')
      newWs.send(JSON.stringify({ type: 'subscribe', orderId }))
      setError('') // Clear any connection errors
    }

    newWs.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message.type === 'order_status' && message.orderId === orderId) {
          if (STATUS_ORDER[message.status] !== undefined) {
            setStatus(message.status)
          }
        }
      } catch (e) {
        console.error('WS parse error:', e)
      }
    }

    newWs.onerror = () => {
      console.log('WebSocket error, will retry...')
    }

    newWs.onclose = () => {
      console.log('WebSocket closed, reconnecting in 3s...')
      setError('Notification service restarting... reconnecting...')
      
      // Auto-reconnect after 3 seconds
      reconnectTimer = setTimeout(() => {
        console.log('Attempting WebSocket reconnect')
        connectWebSocket(orderId)
      }, 3000)
    }

    setWs(newWs)
  }

  const handlePlaceOrder = async (orderData) => {
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await placeOrder(
        {
          itemId: orderData.itemId,
          quantity: orderData.quantity
        },
        token,
        config.gatewayBaseUrl
      )
      
      const orderId = response.orderId || response.id
      if (!orderId) {
        throw new Error('No order ID received')
      }

      setOrder({ id: orderId, ...orderData })
      setStatus('PENDING')
      setSuccess('Order placed successfully! Tracking your order...')
      
      // Connect WebSocket for real-time updates
      connectWebSocket(orderId)

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogoutClick = () => {
    if (ws) ws.close()
    handleLogout()
    navigate('/')
  }

  const handleAdminClick = () => {
    navigate('/admin')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header onLogout={handleLogoutClick} onAdminClick={handleAdminClick} />
      
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <div className="grid gap-6">
          {/* Order Form Section */}
          <div className="bg-white rounded-lg shadow">
            <div className="border-b border-slate-200 p-6">
              <h2 className="text-xl font-bold text-slate-900">Place Your Order</h2>
              <p className="text-sm text-slate-600 mt-1">Select items and quantity</p>
            </div>
            <div className="p-6">
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              {success && (
                <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-700">{success}</p>
                </div>
              )}
              <OrderForm 
                onSubmit={handlePlaceOrder}
                disabled={loading}
              />
            </div>
          </div>

          {/* Order Tracking Section */}
          {order && (
            <div className="bg-white rounded-lg shadow">
              <div className="border-b border-slate-200 p-6">
                <h2 className="text-xl font-bold text-slate-900">Order Status</h2>
                <p className="text-sm text-slate-600 mt-1">Order ID: {order.id}</p>
              </div>
              <div className="p-6">
                {loading && (
                  <div className="flex items-center justify-center py-4">
                    <Loader className="w-5 h-5 animate-spin text-blue-600" />
                  </div>
                )}
                {status && (
                  <OrderTracker currentStatus={status} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
