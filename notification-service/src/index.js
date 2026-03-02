const express = require('express');
const amqp = require('amqplib');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');

const PORT = Number(process.env.PORT || 8084);
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672';
const RABBITMQ_EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'orders.x';
const RABBITMQ_NOTIFY_QUEUE = process.env.RABBITMQ_NOTIFY_QUEUE || 'notify.q';
const ENABLE_CHAOS = String(process.env.ENABLE_CHAOS || '').toLowerCase() === 'true';

const STATUS_RANK = {
  PENDING: 0,
  STOCK_VERIFIED: 1,
  IN_KITCHEN: 2,
  READY: 3
};

const app = express();
app.use(express.json());
app.use(cors({
  origin: true,
  credentials: true
}));

const metrics = {
  ws_messages_out_total: 0,
  events_received_total: 0,
  events_forwarded_total: 0,
  events_failed_total: 0,
  event_forward_latency_total_ms: 0,
  http_requests_total: 0,
  http_failures_total: 0,
  http_latency_total_ms: 0
};

const latestStatus = new Map();
const wsSubscriptions = new Map();

let rabbitConnection = null;
let rabbitChannel = null;
let consumerTag = null;
let reconnectTimer = null;
let shuttingDown = false;
let rabbitConnected = false;

function nowIso() {
  return new Date().toISOString();
}

function average(total, count) {
  if (!count) {
    return 0;
  }
  return Number((total / count).toFixed(2));
}

function statusFromEvent(routingKey, payload) {
  if (routingKey === 'order.created') {
    return 'STOCK_VERIFIED';
  }

  if (routingKey === 'order.status_changed' && (payload.status === 'IN_KITCHEN' || payload.status === 'READY')) {
    return payload.status;
  }

  return null;
}

function shouldAdvanceStatus(orderId, incomingStatus) {
  const currentStatus = latestStatus.get(orderId) || 'PENDING';
  return STATUS_RANK[incomingStatus] > STATUS_RANK[currentStatus];
}

function pushToSubscribers(orderId, status, timestamp) {
  const message = JSON.stringify({
    type: 'order_status',
    orderId,
    status,
    timestamp
  });

  for (const [socket, subscribedOrderId] of wsSubscriptions.entries()) {
    if (subscribedOrderId !== orderId) {
      continue;
    }

    if (socket.readyState !== 1) {
      continue;
    }

    try {
      socket.send(message);
      metrics.ws_messages_out_total += 1;
    } catch (error) {
      // Ignore send failures for demo simplicity.
    }
  }
}

async function handleOrderEvent(msg, routingKey) {
  const startedAt = Date.now();
  metrics.events_received_total += 1;

  let payload;
  try {
    payload = JSON.parse(msg.content.toString('utf8'));
  } catch (error) {
    console.error(`[${nowIso()}] ❌ Failed to parse event message`);
    metrics.events_failed_total += 1;
    return;
  }

  const orderId = payload && payload.orderId;
  if (typeof orderId !== 'string' || orderId.trim() === '') {
    console.error(`[${nowIso()}] ❌ Invalid orderId in event`);
    metrics.events_failed_total += 1;
    return;
  }

  const incomingStatus = statusFromEvent(routingKey, payload);
  if (!incomingStatus) {
    return;
  }

  if (!shouldAdvanceStatus(orderId, incomingStatus)) {
    console.log(`[${nowIso()}] ⚠️  Order ${orderId}: Status ${incomingStatus} not advancing (already at ${latestStatus.get(orderId) || 'PENDING'})`);
    return;
  }

  // Get previous status for transition logging
  const previousStatus = latestStatus.get(orderId) || 'PENDING';
  
  // Map status to emoji
  const statusEmoji = {
    'PENDING': '🕒',
    'STOCK_VERIFIED': '✅',
    'IN_KITCHEN': '👨‍🍳',
    'READY': '🎉'
  };
  
  const emoji = statusEmoji[incomingStatus] || '📢';
  console.log(`[${nowIso()}] ${emoji} Order ${orderId}: ${previousStatus} → ${incomingStatus}`);
  latestStatus.set(orderId, incomingStatus);
  
  const subscriberCount = Array.from(wsSubscriptions.entries()).filter(([_, subOrderId]) => subOrderId === orderId).length;
  console.log(`[${nowIso()}] 📤 Broadcasting to ${subscriberCount} WebSocket subscriber(s) for order ${orderId}`);
  
  pushToSubscribers(orderId, incomingStatus, nowIso());

  metrics.events_forwarded_total += 1;
  metrics.event_forward_latency_total_ms += Date.now() - startedAt;
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
    consumerTag = null;

    if (!shuttingDown) {
      scheduleReconnect();
    }
  });

  rabbitChannel = await rabbitConnection.createChannel();
  await rabbitChannel.assertExchange(RABBITMQ_EXCHANGE, 'topic', { durable: true });
  await rabbitChannel.assertQueue(RABBITMQ_NOTIFY_QUEUE, { durable: true });
  await rabbitChannel.bindQueue(RABBITMQ_NOTIFY_QUEUE, RABBITMQ_EXCHANGE, 'order.created');
  await rabbitChannel.bindQueue(RABBITMQ_NOTIFY_QUEUE, RABBITMQ_EXCHANGE, 'order.status_changed');

  const consumeResult = await rabbitChannel.consume(
    RABBITMQ_NOTIFY_QUEUE,
    async (msg) => {
      if (!msg) {
        return;
      }

      try {
        await handleOrderEvent(msg, msg.fields.routingKey);
      } catch (error) {
        metrics.events_failed_total += 1;
      } finally {
        if (rabbitChannel) {
          rabbitChannel.ack(msg);
        }
      }
    },
    { noAck: false }
  );

  consumerTag = consumeResult.consumerTag;
  rabbitConnected = true;
}

async function connectRabbitWithRetry() {
  try {
    await setupRabbit();
    console.log(`[${nowIso()}] ✅ Connected to RabbitMQ successfully`);
    console.log(`[${nowIso()}] 🎧 Listening for order events on queue: ${RABBITMQ_NOTIFY_QUEUE}`);
  } catch (error) {
    rabbitConnected = false;
    console.error(`[${nowIso()}] ❌ RabbitMQ connect failed:`, error.message);
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

app.get('/health', async (req, res) => {
  try {
    if (!rabbitConnected || !rabbitChannel) {
      return res.status(503).json({ status: 'down' });
    }

    await rabbitChannel.checkQueue(RABBITMQ_NOTIFY_QUEUE);
    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    rabbitConnected = false;
    return res.status(503).json({ status: 'down' });
  }
});

app.get('/metrics', (req, res) => {
  res.status(200).json({
    ws_clients_connected: wsServer.clients.size,
    ws_messages_out_total: metrics.ws_messages_out_total,
    events_received_total: metrics.events_received_total,
    events_forwarded_total: metrics.events_forwarded_total,
    events_failed_total: metrics.events_failed_total,
    avg_event_forward_latency_ms: average(metrics.event_forward_latency_total_ms, metrics.events_forwarded_total),
    http_requests_total: metrics.http_requests_total,
    http_failures_total: metrics.http_failures_total,
    avg_http_latency_ms: average(metrics.http_latency_total_ms, metrics.http_requests_total)
  });
});

app.post('/chaos/kill', (req, res) => {
  if (!ENABLE_CHAOS) {
    return res.status(403).json({ error: 'Chaos mode is disabled' });
  }

  res.status(202).json({ status: 'terminating' });

  setTimeout(() => {
    process.exit(1);
  }, 50);
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const server = http.createServer(app);

const wsServer = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  if (request.url !== '/ws') {
    socket.destroy();
    return;
  }

  wsServer.handleUpgrade(request, socket, head, (ws) => {
    wsServer.emit('connection', ws, request);
  });
});

wsServer.on('connection', (ws) => {
  console.log(`[${nowIso()}] 🔌 WebSocket client connected (${wsServer.clients.size} total clients)`);
  
  ws.on('message', (data) => {
    let message;
    try {
      message = JSON.parse(data.toString('utf8'));
    } catch (error) {
      return;
    }

    if (!message || message.type !== 'subscribe' || typeof message.orderId !== 'string' || message.orderId.trim() === '') {
      return;
    }

    const orderId = message.orderId;
    wsSubscriptions.set(ws, orderId);
    console.log(`[${nowIso()}] 📝 Client subscribed to order: ${orderId}`);

    const replayStatus = latestStatus.get(orderId);
    if (!replayStatus) {
      console.log(`[${nowIso()}] 📭 No status to replay for order ${orderId} (first subscription)`);
      return;
    }

    // Map status to emoji for replay
    const statusEmoji = {
      'PENDING': '🕒',
      'STOCK_VERIFIED': '✅',
      'IN_KITCHEN': '👨‍🍳',
      'READY': '🎉'
    };
    const emoji = statusEmoji[replayStatus] || '📢';
    
    console.log(`[${nowIso()}] ${emoji} Replaying status for order ${orderId}: ${replayStatus}`);
    try {
      ws.send(
        JSON.stringify({
          type: 'order_status',
          orderId,
          status: replayStatus,
          timestamp: nowIso()
        })
      );
      metrics.ws_messages_out_total += 1;
    } catch (error) {
      // Ignore send failures for demo simplicity.
    }
  });

  ws.on('close', () => {
    const orderId = wsSubscriptions.get(ws);
    wsSubscriptions.delete(ws);
    console.log(`[${nowIso()}] 🔌 WebSocket client disconnected${orderId ? ` (was subscribed to ${orderId})` : ''} (${wsServer.clients.size} remaining)`);
  });

  ws.on('error', () => {
    wsSubscriptions.delete(ws);
  });
});

server.listen(PORT, () => {
  console.log(`notification-service listening on port ${PORT}`);
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

  wsServer.clients.forEach((client) => {
    try {
      client.close();
    } catch (error) {
      // Ignore close failures.
    }
  });

  server.close(() => {
    console.log('HTTP server closed');
  });

  try {
    if (rabbitChannel && consumerTag) {
      await rabbitChannel.cancel(consumerTag);
    }
  } catch (error) {
    console.error('Error cancelling consumer:', error.message);
  }

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
