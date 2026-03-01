import dotenv from 'dotenv';

dotenv.config();

export const config = {
    port: parseInt(process.env.PORT || '4002', 10),
    mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/stock-service?replicaSet=rs0',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    nodeEnv: process.env.NODE_ENV || 'development',
    redis: {
        idempotencyTTL: 60 * 60 * 24, // 24 hours in seconds
    },
};
