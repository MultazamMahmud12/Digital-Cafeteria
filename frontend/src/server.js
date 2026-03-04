import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(path.dirname(__dirname), '.env') });

const app = express();

const PORT = Number(process.env.PORT || 8085);
const PUBLIC_IDENTITY_URL = process.env.PUBLIC_IDENTITY_URL || 'http://localhost:8081';
const PUBLIC_GATEWAY_URL = process.env.PUBLIC_GATEWAY_URL || 'http://localhost:8090';
const PUBLIC_STOCK_URL = process.env.PUBLIC_STOCK_URL || 'http://localhost:8082';
const PUBLIC_KITCHEN_URL = process.env.PUBLIC_KITCHEN_URL || 'http://localhost:8083';
const PUBLIC_NOTIFICATION_URL = process.env.PUBLIC_NOTIFICATION_URL || 'http://localhost:8084';
const PUBLIC_NOTIFICATION_WS_URL = process.env.PUBLIC_NOTIFICATION_WS_URL || 'ws://localhost:8084/ws';
const RABBITMQ_MANAGEMENT_URL = process.env.RABBITMQ_MANAGEMENT_URL || 'http://localhost:15672';

// Container name mapping
const CONTAINER_NAMES = {
  'Identity': 'identity-service',
  'Gateway': 'gateway-service',
  'Stock': 'stock-service',
  'Kitchen': 'kitchen-service',
  'Notification': 'notification-service'
};

app.use(express.json());

app.get('/api/config', (req, res) => {
  res.status(200).json({
    identityBaseUrl: PUBLIC_IDENTITY_URL,
    identityLoginPath: '/auth/login',
    gatewayBaseUrl: PUBLIC_GATEWAY_URL,
    gatewayOrderPath: '/orders',
    stockBaseUrl: PUBLIC_STOCK_URL,
    kitchenBaseUrl: PUBLIC_KITCHEN_URL,
    notificationBaseUrl: PUBLIC_NOTIFICATION_URL,
    notificationWsUrl: PUBLIC_NOTIFICATION_WS_URL,
    services: [
      { name: 'Identity', url: PUBLIC_IDENTITY_URL },
      { name: 'Gateway', url: PUBLIC_GATEWAY_URL },
      { name: 'Stock', url: PUBLIC_STOCK_URL },
      { name: 'Kitchen', url: PUBLIC_KITCHEN_URL },
      { name: 'Notification', url: PUBLIC_NOTIFICATION_URL }
    ]
  });
});

// Legacy endpoint for backward compatibility
app.get('/config', (req, res) => {
  res.redirect(301, '/api/config');
});

// Start Docker container
app.post('/api/docker/start/:serviceName', async (req, res) => {
  try {
    const serviceName = req.params.serviceName;
    const containerName = CONTAINER_NAMES[serviceName];
    
    if (!containerName) {
      return res.status(400).json({ error: 'Invalid service name' });
    }

    await execAsync(`docker start ${containerName}`);
    res.status(200).json({ status: 'started', service: serviceName });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Docker container logs
app.get('/api/docker/logs/:serviceName', async (req, res) => {
  try {
    const serviceName = req.params.serviceName;
    const containerName = CONTAINER_NAMES[serviceName];
    const tail = req.query.tail || '100';
    
    if (!containerName) {
      return res.status(400).json({ error: 'Invalid service name' });
    }

    const { stdout } = await execAsync(`docker logs ${containerName} --tail ${tail}`);
    res.status(200).json({ logs: stdout });
  } catch (error) {
    res.status(500).json({ error: error.message, logs: '' });
  }
});

// Get RabbitMQ queue information
app.get('/api/rabbitmq/queues', async (req, res) => {
  try {
    const response = await fetch(`${RABBITMQ_MANAGEMENT_URL}/api/queues`, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from('guest:guest').toString('base64')
      }
    });
    
    if (!response.ok) {
      throw new Error(`RabbitMQ API returned ${response.status}`);
    }
    
    const queues = await response.json();
    
    // Filter for our specific queues
    const relevantQueues = queues.filter(q => 
      q.name === 'kitchen.q' || q.name === 'notify.q'
    ).map(q => ({
      name: q.name,
      messages: q.messages || 0,
      messages_ready: q.messages_ready || 0,
      messages_unacknowledged: q.messages_unacknowledged || 0,
      consumers: q.consumers || 0,
      state: q.state
    }));
    
    res.status(200).json({ queues: relevantQueues });
  } catch (error) {
    res.status(500).json({ error: error.message, queues: [] });
  }
});

// Serve React build
const distPath = path.join(__dirname, '..', 'dist');

// Serve React build
app.use(express.static(distPath));

// SPA fallback - serve index.html for all unknown routes (except /api routes)
app.get('*', (req, res) => {
  // Don't intercept /api routes
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`frontend listening on port ${PORT}`);
});
