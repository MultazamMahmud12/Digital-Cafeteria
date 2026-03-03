import axios from 'axios'

const api = axios.create({
  baseURL: window.location.origin
})

export const fetchConfig = async () => {
  const response = await api.get('/api/config')
  return response.data
}

export const login = async (credentials, identityUrl) => {
  try {
    const response = await axios.post(
      `${identityUrl}/auth/login`,
      credentials,
      {
        headers: { 'Content-Type': 'application/json' }
      }
    )
    return response.data
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Login failed')
  }
}

export const register = async (details, identityUrl) => {
  try {
    const response = await axios.post(
      `${identityUrl}/auth/register`,
      details,
      {
        headers: { 'Content-Type': 'application/json' }
      }
    )
    return response.data
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Registration failed')
  }
}

export const placeOrder = async (orderData, token, gatewayUrl) => {
  try {
    const response = await axios.post(
      `${gatewayUrl}/orders`,
      orderData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    )
    return response.data
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to place order')
  }
}

export const checkServiceHealth = async (serviceUrl) => {
  try {
    const response = await axios.get(`${serviceUrl}/health`, {
      timeout: 1500 // Shorter timeout to catch outages faster
    })
    return { healthy: response.status === 200, message: response.data?.message || 'OK' }
  } catch (error) {
    return { healthy: false, message: error.message }
  }
}

export const getMetrics = async (metricsUrl) => {
  try {
    const response = await axios.get(metricsUrl, {
      timeout: 5000
    })
    return response.data
  } catch (error) {
    return null
  }
}

export const killService = async (serviceUrl) => {
  try {
    const response = await axios.post(`${serviceUrl}/chaos/kill`)
    return response.data
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to trigger chaos')
  }
}

export const startService = async (serviceName) => {
  try {
    const response = await axios.post(`/api/docker/start/${serviceName}`)
    return response.data
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to start service')
  }
}

export const getServiceLogs = async (serviceName, tail = 50) => {
  try {
    const response = await axios.get(`/api/docker/logs/${serviceName}?tail=${tail}`)
    return response.data
  } catch (error) {
    return { logs: '', error: error.message }
  }
}

export const getRabbitMQQueues = async () => {
  try {
    const response = await axios.get('/api/rabbitmq/queues')
    return response.data
  } catch (error) {
    return { queues: [], error: error.message }
  }
}
