const express = require('express');
const expressProxy = require('express-http-proxy');
const app = express();
const dotenv = require('dotenv');
const redisClient = require('./config/redis');
const orderRoutes = require('./routes/orderRoutes');

// observability
const { metricsMiddleware, getMetrics } = require('./middleware/metrics');


dotenv.config();

// redisClient.connect() is already invoked in config/redis.js when the client
// is created. Calling it again causes a "Socket already opened" error, so we
// rely on that single connection attempt here.

app.use(express.json());

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

// instrumentation middleware must come before other routes to capture everything
app.use(metricsMiddleware);

// Routes
app.use('/user', expressProxy('http://localhost:3001'));
app.use('/order', orderRoutes);

app.listen(3000, () => { console.log("Gateway is running on port 3000") })