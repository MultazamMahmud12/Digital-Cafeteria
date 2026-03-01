import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

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

// Serve React build
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// SPA fallback - serve index.html for all unknown routes
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`frontend listening on port ${PORT}`);
});
