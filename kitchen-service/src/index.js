const express = require('express');
const amqp = require('amqplib');
const cors = require('cors');

const PORT = Number(process.env.PORT || 8083);
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672';
const RABBITMQ_EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'orders.x';
const RABBITMQ_KITCHEN_QUEUE = process.env.RABBITMQ_KITCHEN_QUEUE || 'kitchen.q';
const ENABLE_CHAOS = String(process.env.ENABLE_CHAOS || '').toLowerCase() === 'true';

const app = express();
app.use(express.json());
app.use(cors({
  origin: true,
  credentials: true
}));

let connection = null;
let channel = null;
let consumerTag = null;
let reconnectTimer = null;
let shuttingDown = false;
let rabbitConnected = false;

const processedOrderIds = new Set();

const metrics = {
  jobs_processed_total: 0,
  jobs_failed_total: 0,
  job_latency_total_ms: 0,
  http_requests_total: 0,
  http_failures_total: 0,
  http_latency_total_ms: 0
};

function nowIso() {
  return new Date().toISOString();
}

function getAverage(total, count) {
  if (!count) return 0;
  return Number((total / count).toFixed(2));
}

function randomDelayMs() {
  return Math.floor(Math.random() * 5000) + 3000;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function publishOrderStatus(orderId, status) {
  if (!channel) {
    throw new Error('RabbitMQ channel is not available');
  }

  const payload = {
    orderId,
    status,
    timestamp: nowIso()
  };

  channel.publish(
    RABBITMQ_EXCHANGE,
    'order.status_changed',
    Buffer.from(JSON.stringify(payload)),
    {
      persistent: true,
      contentType: 'application/json'
    }
  );
}

async function setupRabbit() {
  connection = await amqp.connect(RABBITMQ_URL);
  connection.on('error', () => {
    rabbitConnected = false;
  });

  connection.on('close', () => {
    rabbitConnected = false;
    channel = null;
    consumerTag = null;

    if (!shuttingDown) {
      scheduleReconnect();
    }
  });

  channel = await connection.createChannel();
  await channel.assertExchange(RABBITMQ_EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(RABBITMQ_KITCHEN_QUEUE, { durable: true });
  await channel.bindQueue(RABBITMQ_KITCHEN_QUEUE, RABBITMQ_EXCHANGE, 'order.created');
  await channel.prefetch(1);

  const consumeResult = await channel.consume(
    RABBITMQ_KITCHEN_QUEUE,
    async (msg) => {
      if (!msg) {
        return;
      }

      const startedAt = Date.now();

      try {
        let parsed;

        try {
          parsed = JSON.parse(msg.content.toString('utf8'));
        } catch (error) {
          console.error(`[${nowIso()}] ❌ Failed to parse message`);
          metrics.jobs_failed_total += 1;
          channel.ack(msg);
          return;
        }

        const orderId = parsed && parsed.orderId;
        if (typeof orderId !== 'string' || orderId.trim() === '') {
          console.error(`[${nowIso()}] ❌ Invalid orderId in message`);
          metrics.jobs_failed_total += 1;
          channel.ack(msg);
          return;
        }

        if (processedOrderIds.has(orderId)) {
          console.log(`[${nowIso()}] ⚠️  Order ${orderId} already processed (idempotent skip)`);
          channel.ack(msg);
          return;
        }

        console.log(`[${nowIso()}] 📥 Received order ${orderId} from queue`);
        
        processedOrderIds.add(orderId);

        console.log(`[${nowIso()}] 👨‍🍳 Order ${orderId} moved to kitchen (status: IN_KITCHEN)`);
        publishOrderStatus(orderId, 'IN_KITCHEN');
        
        const cookingTime = randomDelayMs();
        console.log(`[${nowIso()}] 🔥 Cooking order ${orderId}... (${cookingTime}ms)`);
        await sleep(cookingTime);
        
        console.log(`[${nowIso()}] ✅ Order ${orderId} is ready for pickup!`);
        publishOrderStatus(orderId, 'READY');

        metrics.jobs_processed_total += 1;
        metrics.job_latency_total_ms += Date.now() - startedAt;

        channel.ack(msg);
      } catch (error) {
        console.error(`[${nowIso()}] ❌ Error processing order:`, error.message);
        metrics.jobs_failed_total += 1;
        if (channel) {
          channel.ack(msg);
        }
      }
    },
    { noAck: false }
  );

  consumerTag = consumeResult.consumerTag;
  rabbitConnected = true;
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

async function connectRabbitWithRetry() {
  try {
    await setupRabbit();
    console.log(`[${nowIso()}] ✅ Connected to RabbitMQ successfully`);
    console.log(`[${nowIso()}] 🎧 Listening for orders on queue: ${RABBITMQ_KITCHEN_QUEUE}`);
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
    if (!rabbitConnected || !channel) {
      return res.status(503).json({ status: 'down' });
    }

    await channel.checkQueue(RABBITMQ_KITCHEN_QUEUE);
    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    rabbitConnected = false;
    return res.status(503).json({ status: 'down' });
  }
});

app.get('/metrics', (req, res) => {
  res.status(200).json({
    jobs_processed_total: metrics.jobs_processed_total,
    jobs_failed_total: metrics.jobs_failed_total,
    avg_job_latency_ms: getAverage(metrics.job_latency_total_ms, metrics.jobs_processed_total),
    http_requests_total: metrics.http_requests_total,
    http_failures_total: metrics.http_failures_total,
    avg_http_latency_ms: getAverage(metrics.http_latency_total_ms, metrics.http_requests_total)
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

const server = app.listen(PORT, () => {
  console.log(`kitchen-service listening on port ${PORT}`);
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
    if (channel && consumerTag) {
      await channel.cancel(consumerTag);
    }
  } catch (error) {
    console.error('Error cancelling consumer:', error.message);
  }

  try {
    if (channel) {
      await channel.close();
    }
  } catch (error) {
    console.error('Error closing channel:', error.message);
  }

  try {
    if (connection) {
      await connection.close();
    }
  } catch (error) {
    console.error('Error closing connection:', error.message);
  }

  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

connectRabbitWithRetry();
