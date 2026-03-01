const express = require('express');
const expressProxy = require('express-http-proxy');
const app = express();
const dotenv = require('dotenv');
const redisClient = require('./config/redis');
const rabbitmq = require('./config/rabbitmq');
const cors = require('cors');
const orderRoutes = require('./routes/orderRoutes');

// observability
const { metricsMiddleware, getMetrics, getMetricsJson } = require('./middleware/metrics');


dotenv.config();

const identityServiceUrl = process.env.IDENTITY_SERVICE_URL || 'http://localhost:3001';

// redisClient.connect() is already invoked in config/redis.js when the client
// is created. Calling it again causes a "Socket already opened" error, so we
// rely on that single connection attempt here.

// Connect to RabbitMQ
rabbitmq.connect();

app.use(express.json());
app.use(cors({
    origin: true,
    credentials: true
}));

// health check
app.get('/health', async (req, res) => {
    try {
        const redisStatus = redisClient.isOpen ? 'connected' : 'disconnected';
        if (redisStatus === 'connected') {
            return res.status(200).json({ status: 'healthy', redis: redisStatus });
        }
        return res.status(503).json({ status: 'unhealthy', redis: redisStatus });
    } catch (err) {
        return res.status(500).json({ status: 'error', error: err.message });
    }
});

// metrics endpoint
app.get('/metrics', getMetrics);
app.get('/metrics/json', getMetricsJson);

// instrumentation middleware must come before other routes to capture everything
app.use(metricsMiddleware);

// Routes
app.use('/user', expressProxy(identityServiceUrl));
app.use('/order', orderRoutes);
app.use('/orders', orderRoutes);

app.listen(3000, () => { console.log("Gateway is running on port 3000") })