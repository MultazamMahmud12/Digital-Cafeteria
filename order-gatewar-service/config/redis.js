const { createClient } = require('redis');

// prefer a single connection URL so that Docker DNS names work reliably
const redisUrl = process.env.REDIS_URL ||
                `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;

const redisClient = createClient({
    url: redisUrl,
    password: process.env.REDIS_PASSWORD || undefined,
    socket: {
        reconnectStrategy: (retries) => {
            if (retries > 5) {
                console.warn('⚠️  Redis reconnection failed. Running without cache.');
                return new Error('Max retries reached');
            }
            return retries * 100;
        }
    }
});

redisClient.on('error', (err) => {
    if (err.code === 'ECONNREFUSED') {
        console.log('⚠️  Redis is not available. Cache features will be disabled.');
    } else {
        console.error('❌ Redis Client Error', err);
    }
});

redisClient.on('connect', () => {
    console.log('✅ Connected to Redis successfully');
});

redisClient.on('ready', () => {
    console.log('✅ Redis client ready');
});

// Try to connect but don't block app startup if it fails
redisClient.connect().catch(() => {
    console.log('⚠️  Continuing without Redis. Cache operations will fail gracefully.');
});

module.exports = redisClient;
