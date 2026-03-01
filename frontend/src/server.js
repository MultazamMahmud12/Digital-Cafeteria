const express = require('express');
const path = require('path');

const app = express();

const PORT = Number(process.env.PORT || 8085);
const PUBLIC_IDENTITY_URL = process.env.PUBLIC_IDENTITY_URL || 'http://localhost:8081';
const PUBLIC_GATEWAY_URL = process.env.PUBLIC_GATEWAY_URL || 'http://localhost:8080';
const PUBLIC_STOCK_URL = process.env.PUBLIC_STOCK_URL || 'http://localhost:8082';
const PUBLIC_KITCHEN_URL = process.env.PUBLIC_KITCHEN_URL || 'http://localhost:8083';
const PUBLIC_NOTIFICATION_URL = process.env.PUBLIC_NOTIFICATION_URL || 'http://localhost:8084';
const PUBLIC_NOTIFICATION_WS_URL = process.env.PUBLIC_NOTIFICATION_WS_URL || 'ws://localhost:8084/ws';

const identityLoginPath = '/auth/login';
const gatewayOrderPath = '/orders';

app.get('/config', (req, res) => {
  res.status(200).json({
    identityBaseUrl: PUBLIC_IDENTITY_URL,
    identityLoginPath,
    gatewayBaseUrl: PUBLIC_GATEWAY_URL,
    gatewayOrderPath,
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

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
  res.redirect('/student.html');
});

app.listen(PORT, () => {
  console.log(`frontend listening on port ${PORT}`);
});
