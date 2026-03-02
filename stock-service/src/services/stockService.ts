import mongoose from 'mongoose';
import { stockRepository } from '../repositories/stockRepository';
import { processedOrderRepository } from '../repositories/processedOrderRepository';
import { getRedisClient } from '../config/redis';
import { config } from '../config/index';
import { logger } from '../config/logger';
import { metricsStore } from '../metrics/metricsStore';
import {
    InsufficientStockError,
    DuplicateOrderError,
    ServiceUnavailableError,
    ValidationError,
} from '../middleware/errorHandler';

export interface DeductionItem {
    itemId: string;
    quantity: number;
}

export interface DeductionRequest {
    orderId: string;
    items: DeductionItem[];
}

export interface DeductionResponse {
    orderId: string;
    status: 'success';
    message: string;
    deductedItems: DeductionItem[];
}

export const stockService = {
    async deductStock(request: DeductionRequest): Promise<DeductionResponse> {
        const { orderId, items } = request;

        // Step 1: Check Redis for idempotency (fast path)
        try {
            const redis = getRedisClient();
            const cached = await redis.get(`order:${orderId}`);
            if (cached) {
                const cachedResult = JSON.parse(cached) as DeductionResponse;
                logger.info('Idempotent replay from Redis', { orderId });
                return cachedResult;
            }
        } catch (err) {
            // Redis down — fall through to DB check, don't block the request
            logger.warn('Redis unavailable for idempotency check, falling back to DB', {
                orderId,
                error: (err as Error).message,
            });
        }

        // Step 2: Fallback DB idempotency check
        const existingOrder = await processedOrderRepository.findByOrderId(orderId);
        if (existingOrder) {
            if (existingOrder.status === 'success') {
                logger.info('Idempotent replay from DB', { orderId });
                // Re-cache in Redis for future fast lookups
                const replayResult: DeductionResponse = {
                    orderId,
                    status: 'success',
                    message: 'Order already processed (idempotent replay)',
                    deductedItems: items,
                };
                try {
                    const redis = getRedisClient();
                    await redis.setex(
                        `order:${orderId}`,
                        config.redis.idempotencyTTL,
                        JSON.stringify(replayResult)
                    );
                } catch {
                    // Redis re-cache failed; non-critical
                }
                return replayResult;
            }
            // If status was 'failed', we allow retry
        }

        // Step 3: Execute transactional deduction
        logger.info(`📦 Processing stock deduction for order ${orderId}`, {
            orderId,
            itemCount: items.length,
            items: items.map(i => ({ itemId: i.itemId, quantity: i.quantity })),
        });

        const session = await mongoose.startSession();
        let result: DeductionResponse;
        let insufficientStockError: InsufficientStockError | null = null;

        try {
            await session.withTransaction(async () => {
                // Deduct each item atomically
                for (const item of items) {
                    const success = await stockRepository.deductStock(
                        item.itemId,
                        item.quantity,
                        session
                    );

                    if (!success) {
                        logger.warn(`❌ Insufficient stock for item ${item.itemId}`, {
                            orderId,
                            itemId: item.itemId,
                            requestedQuantity: item.quantity,
                        });
                        // Store the error before throwing so we can re-throw it properly
                        // session.withTransaction() may wrap the error
                        insufficientStockError = new InsufficientStockError(
                            `Insufficient stock for item ${item.itemId}`
                        );
                        throw insufficientStockError;
                    }

                    // Get remaining stock after deduction
                    const remainingStock = await stockRepository.getStock(item.itemId);
                    logger.info(`✅ Stock deducted for item ${item.itemId}`, {
                        orderId,
                        itemId: item.itemId,
                        deductedQuantity: item.quantity,
                        remainingStock: remainingStock ?? 0,
                    });
                }

                // All deductions succeeded — record processed order within the same transaction
                await processedOrderRepository.create(orderId, 'success', session);
            });

            // If withTransaction didn't throw but insufficientStockError was set,
            // the transaction was aborted silently
            if (insufficientStockError) {
                metricsStore.incrementFailed();
                throw insufficientStockError;
            }

            result = {
                orderId,
                status: 'success',
                message: 'Stock deducted successfully',
                deductedItems: items,
            };

            logger.info(`✅ Order ${orderId} completed successfully`, {
                orderId,
                totalItems: items.length,
                status: 'success',
            });

            metricsStore.incrementSuccessful();
        } catch (error) {
            // Re-throw InsufficientStockError (may come from above or from instanceof check)
            if (error instanceof InsufficientStockError) {
                metricsStore.incrementFailed();
                throw error;
            }

            // Check if the insufficientStockError was set inside the transaction
            if (insufficientStockError) {
                metricsStore.incrementFailed();
                throw insufficientStockError;
            }

            // Handle duplicate key error (concurrent duplicate orderId)
            if (
                error instanceof Error &&
                'code' in error &&
                (error as { code: number }).code === 11000
            ) {
                metricsStore.incrementFailed();
                throw new DuplicateOrderError(`Order ${orderId} already processed`);
            }

            metricsStore.incrementFailed();
            logger.error('Transaction failed', { orderId, error });
            throw new ServiceUnavailableError('Stock deduction failed due to internal error');
        } finally {
            await session.endSession();
        }

        // Step 4: Post-commit — cache in Redis
        try {
            const redis = getRedisClient();
            await redis.setex(
                `order:${orderId}`,
                config.redis.idempotencyTTL,
                JSON.stringify(result)
            );
        } catch (err) {
            // Redis cache failure is non-critical — DB has the record
            logger.warn('Failed to cache order result in Redis', {
                orderId,
                error: (err as Error).message,
            });
        }

        return result;
    },

    async getStock(itemId: string): Promise<{ itemId: string; available: number }> {
        if (!mongoose.Types.ObjectId.isValid(itemId)) {
            throw new ValidationError('Invalid itemId format');
        }

        const stock = await stockRepository.getStock(itemId);

        // If stock is null, the item doesn't exist
        if (stock === null) {
            throw new ValidationError(`Item with ID ${itemId} not found`);
        }

        return {
            itemId,
            available: stock,
        };
    },
};
