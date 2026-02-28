import app from './app';
import { config } from './config/index';
import { connectDB } from './config/database';
import { createRedisClient } from './config/redis';
import { logger } from './config/logger';

const bootstrap = async (): Promise<void> => {
    try {
        // Connect to MongoDB
        await connectDB();

        // Connect to Redis
        const redis = createRedisClient();
        await redis.connect();

        // Start HTTP server
        app.listen(config.port, () => {
            logger.info(`Stock Service running on port ${config.port}`, {
                port: config.port,
                env: config.nodeEnv,
            });
        });
    } catch (error) {
        logger.error('Failed to start Stock Service', { error });
        process.exit(1);
    }
};

// Handle unhandled rejections
process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled Promise Rejection', { reason });
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
    process.exit(1);
});

bootstrap();
