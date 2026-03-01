const { createClient } = require('redis');

const redisClient = createClient({
    socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379')
    },
    password: process.env.REDIS_PASSWORD || undefined
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
