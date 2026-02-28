import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { getRedisClient } from '../config/redis';
import { metricsStore } from '../metrics/metricsStore';
import { logger } from '../config/logger';

export const healthController = {
    async checkHealth(_req: Request, res: Response): Promise<void> {
        const checks: { mongo: string; redis: string } = {
            mongo: 'down',
            redis: 'down',
        };

        // Check MongoDB
        try {
            if (mongoose.connection.readyState === 1) {
                checks.mongo = 'healthy';
            }
        } catch (err) {
            logger.error('Health check: MongoDB error', { error: (err as Error).message });
        }

        // Check Redis
        try {
            const redis = getRedisClient();
            const pong = await redis.ping();
            if (pong === 'PONG') {
                checks.redis = 'healthy';
            }
        } catch (err) {
            logger.error('Health check: Redis error', { error: (err as Error).message });
        }

        const allHealthy = checks.mongo === 'healthy' && checks.redis === 'healthy';

        res.status(allHealthy ? 200 : 503).json({
            status: allHealthy ? 'healthy' : 'degraded',
            checks,
            timestamp: new Date().toISOString(),
        });
    },

    getMetrics(_req: Request, res: Response): void {
        res.status(200).json({
            success: true,
            data: metricsStore.getMetrics(),
        });
    },
};
