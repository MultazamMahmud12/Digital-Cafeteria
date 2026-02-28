import Redis from 'ioredis';
import { config } from './index';
import { logger } from './logger';

let redisClient: Redis;

export const createRedisClient = (url?: string): Redis => {
    redisClient = new Redis(url || config.redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy(times: number): number | null {
            if (times > 5) {
                logger.error('Redis: max retries reached, giving up');
                return null;
            }
            return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
    });

    redisClient.on('connect', () => {
        logger.info('Redis connected successfully');
    });

    redisClient.on('error', (err: Error) => {
        logger.error('Redis connection error', { error: err.message });
    });

    return redisClient;
};

export const getRedisClient = (): Redis => {
    if (!redisClient) {
        throw new Error('Redis client not initialized. Call createRedisClient() first.');
    }
    return redisClient;
};

export const disconnectRedis = async (): Promise<void> => {
    if (redisClient) {
        await redisClient.quit();
        logger.info('Redis disconnected');
    }
};
