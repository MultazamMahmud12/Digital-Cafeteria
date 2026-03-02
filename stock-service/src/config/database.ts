import mongoose from 'mongoose';
import { config } from './index';
import { logger } from './logger';

export const connectDB = async (): Promise<void> => {
    try {
        await mongoose.connect(config.mongoUri, {
            writeConcern: { w: 'majority' },
            maxPoolSize: 10,
            minPoolSize: 2,
            serverSelectionTimeoutMS: 5000,
            heartbeatFrequencyMS: 10000,
        });
        logger.info('MongoDB connected successfully');
    } catch (error) {
        logger.error('MongoDB connection failed', { error });
        process.exit(1);
    }
};

export const disconnectDB = async (): Promise<void> => {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
};
