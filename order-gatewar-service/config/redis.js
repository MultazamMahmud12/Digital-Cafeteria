const { createClient } = require('redis');

const redisClient = createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
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
