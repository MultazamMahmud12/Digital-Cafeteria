const express = require('express');
const amqp = require('amqplib');
const crypto = require('crypto');
const cors = require('cors');

const PORT = Number(process.env.PORT || 8082);
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672';
const RABBITMQ_EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'orders.x';
const ENABLE_CHAOS = String(process.env.ENABLE_CHAOS || '').toLowerCase() === 'true';

const app = express();
app.use(express.json());
app.use(cors({
  origin: true,
  credentials: true
}));

const inventory = new Map();
const orders = new Map();

let rabbitConnection = null;
let rabbitChannel = null;
let reconnectTimer = null;
let rabbitConnected = false;
let shuttingDown = false;

const metrics = {
  orders_created_total: 0,
  orders_failed_total: 0,
  events_published_total: 0,
  event_publish_failures_total: 0,
  http_requests_total: 0,
  http_failures_total: 0,
  http_latency_total_ms: 0
};

function average(total, count) {
  if (!count) return 0;
  return Number((total / count).toFixed(2));
}

function nowIso() {
  return new Date().toISOString();
}

function getItemStock(itemId) {
  if (!inventory.has(itemId)) {
    inventory.set(itemId, 20);
  }
  return inventory.get(itemId);
}

function setItemStock(itemId, stock) {
  inventory.set(itemId, stock);
}

function publishOrderCreated(order) {
  if (!rabbitChannel) {
    throw new Error('RabbitMQ channel unavailable');
  }

  rabbitChannel.publish(
    RABBITMQ_EXCHANGE,
    'order.created',
    Buffer.from(JSON.stringify({
      orderId: order.orderId,
      userId: order.userId,
      itemId: order.itemId,
      quantity: order.quantity,
      timestamp: order.timestamp
    })),
    {
      persistent: true,
      contentType: 'application/json'
    }
  );

  metrics.events_published_total += 1;
}

function scheduleReconnect() {
  if (reconnectTimer || shuttingDown) {
    return;
  }

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    try {
      await setupRabbit();
      console.log('Reconnected to RabbitMQ');
    } catch (error) {
      console.error('RabbitMQ reconnect failed:', error.message);
      scheduleReconnect();
    }
  }, 5000);
}

async function setupRabbit() {
  rabbitConnection = await amqp.connect(RABBITMQ_URL);

  rabbitConnection.on('error', () => {
    rabbitConnected = false;
  });

  rabbitConnection.on('close', () => {
    rabbitConnected = false;
    rabbitChannel = null;

    if (!shuttingDown) {
      scheduleReconnect();
    }
  });

  rabbitChannel = await rabbitConnection.createChannel();
  await rabbitChannel.assertExchange(RABBITMQ_EXCHANGE, 'topic', { durable: true });
  rabbitConnected = true;
}

async function connectRabbitWithRetry() {
  try {
    await setupRabbit();
    console.log('Connected to RabbitMQ');
  } catch (error) {
    rabbitConnected = false;
    console.error('RabbitMQ connect failed:', error.message);
    scheduleReconnect();
  }
}

app.use((req, res, next) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    metrics.http_requests_total += 1;
    metrics.http_latency_total_ms += Date.now() - startedAt;

    if (res.statusCode >= 400) {
      metrics.http_failures_total += 1;
    }
  });

  next();
});

app.get('/health', (req, res) => {
  if (!rabbitConnected) {
    return res.status(503).json({ status: 'down' });
  }

  return res.status(200).json({ status: 'ok' });
});

app.get('/metrics', (req, res) => {
  res.status(200).json({
    orders_created_total: metrics.orders_created_total,
    orders_failed_total: metrics.orders_failed_total,
    events_published_total: metrics.events_published_total,
    event_publish_failures_total: metrics.event_publish_failures_total,
    avg_http_latency_ms: average(metrics.http_latency_total_ms, metrics.http_requests_total),
    http_requests_total: metrics.http_requests_total,
    http_failures_total: metrics.http_failures_total
  });
});

app.post('/order', (req, res) => {
  try {
    const userId = req.body.userId || 'anonymous';
    const itemId = req.body.itemId || req.body.sku;
    const quantity = Number(req.body.quantity ?? req.body.qty);

    if (!itemId || !Number.isInteger(quantity) || quantity <= 0) {
      metrics.orders_failed_total += 1;
      return res.status(400).json({ message: 'itemId and quantity are required' });
    }

    const currentStock = getItemStock(itemId);
    if (currentStock < quantity) {
      metrics.orders_failed_total += 1;
      return res.status(400).json({ message: 'item is out of stock' });
    }

    const orderId = `ord_${crypto.randomUUID()}`;
    const remainingStock = currentStock - quantity;
    setItemStock(itemId, remainingStock);

    const order = {
      orderId,
      userId,
      itemId,
      quantity,
      status: 'STOCK_VERIFIED',
      timestamp: nowIso(),
      remainingStock
    };

    orders.set(orderId, order);

    try {
      publishOrderCreated(order);
    } catch (error) {
      metrics.event_publish_failures_total += 1;
      console.error('Failed to publish order.created:', error.message);
    }

    metrics.orders_created_total += 1;

    return res.status(201).json({
      orderId,
      itemId,
      quantity,
      status: 'STOCK_VERIFIED',
      remainingStock
    });
  } catch (error) {
    metrics.orders_failed_total += 1;
    return res.status(500).json({ message: 'internal error', error: error.message });
  }
});

app.get('/order/:orderId', (req, res) => {
  const order = orders.get(req.params.orderId);
  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  return res.status(200).json(order);
});

app.post('/chaos/kill', (req, res) => {
  if (!ENABLE_CHAOS) {
    return res.status(403).json({ error: 'Chaos mode is disabled' });
  }

  res.status(202).json({ status: 'terminating' });
  setTimeout(() => process.exit(1), 50);
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const server = app.listen(PORT, () => {
  console.log(`stock-service listening on port ${PORT}`);
});

async function gracefulShutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  server.close(() => {
    console.log('HTTP server closed');
  });

  try {
    if (rabbitChannel) {
      await rabbitChannel.close();
    }
  } catch (error) {
    console.error('Error closing channel:', error.message);
  }

  try {
    if (rabbitConnection) {
      await rabbitConnection.close();
    }
  } catch (error) {
    console.error('Error closing connection:', error.message);
  }

  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

connectRabbitWithRetry();
