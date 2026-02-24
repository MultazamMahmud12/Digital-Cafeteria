const { createClient } = require('redis');

const redisClient = createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
            console.error('Redis connection refused');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
            return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
            return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
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
