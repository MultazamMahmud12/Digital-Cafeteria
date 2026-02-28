const { createClient } = require('redis');

const redisUrl = process.env.REDIS_URL ||
    `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;

const redisClient = createClient({
    url: redisUrl,
    password: process.env.REDIS_PASSWORD || undefined,
    socket: {
        reconnectStrategy: (retries) => {
            if (retries > 10) {
                return new Error('Retry attempts exhausted');
            }
            return Math.min(retries * 100, 3000);
        }
    }
});

redisClient.on('connect', () => {
    console.log('✅ Connected to Redis successfully');
});

redisClient.on('error', (error) => {
    console.error('❌ Redis connection error:', error);
});

redisClient.on('ready', () => {
    console.log('✅ Redis client ready');
});

module.exports = redisClient;
