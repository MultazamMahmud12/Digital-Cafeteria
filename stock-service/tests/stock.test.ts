import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import Redis from 'ioredis-mock';
import express from 'express';
import { FoodItem } from '../src/models/FoodItem';
import { ProcessedOrder } from '../src/models/ProcessedOrder';
import { stockService } from '../src/services/stockService';
import { metricsStore } from '../src/metrics/metricsStore';

// --- Mock Redis before importing modules that use it ---
jest.mock('../src/config/redis', () => {
    const redisMock = new (require('ioredis-mock'))();
    return {
        createRedisClient: jest.fn(() => redisMock),
        getRedisClient: jest.fn(() => redisMock),
        disconnectRedis: jest.fn(async () => { }),
    };
});

jest.mock('../src/config/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

let replSet: MongoMemoryReplSet;

beforeAll(async () => {
    // Start in-memory MongoDB replica set (required for transactions)
    replSet = await MongoMemoryReplSet.create({
        replSet: { count: 1, storageEngine: 'wiredTiger' },
    });

    const uri = replSet.getUri();
    await mongoose.connect(uri);
});

afterAll(async () => {
    await mongoose.disconnect();
    await replSet.stop();
});

beforeEach(async () => {
    // Clean collections before each test
    await FoodItem.deleteMany({});
    await ProcessedOrder.deleteMany({});
    metricsStore.reset();

    // Clear Redis mock
    const { getRedisClient } = require('../src/config/redis');
    const redis = getRedisClient();
    await redis.flushall();
});

describe('Stock Service', () => {
    // ─── Test 1: Successful single-item deduction ───
    describe('Successful Deduction', () => {
        it('should deduct stock successfully for a single item', async () => {
            const item = await FoodItem.create({ name: 'Test Burger', stock: 100 });

            const result = await stockService.deductStock({
                orderId: 'order-success-1',
                items: [{ itemId: item._id.toString(), quantity: 10 }],
            });

            expect(result.status).toBe('success');
            expect(result.orderId).toBe('order-success-1');

            // Verify stock was decremented
            const updated = await FoodItem.findById(item._id);
            expect(updated!.stock).toBe(90);

            // Verify ProcessedOrder was created
            const processed = await ProcessedOrder.findOne({ orderId: 'order-success-1' });
            expect(processed).not.toBeNull();
            expect(processed!.status).toBe('success');
        });

        it('should deduct stock for multiple items in a single order', async () => {
            const item1 = await FoodItem.create({ name: 'Burger', stock: 100 });
            const item2 = await FoodItem.create({ name: 'Fries', stock: 50 });

            const result = await stockService.deductStock({
                orderId: 'order-multi-success',
                items: [
                    { itemId: item1._id.toString(), quantity: 5 },
                    { itemId: item2._id.toString(), quantity: 3 },
                ],
            });

            expect(result.status).toBe('success');

            const updatedItem1 = await FoodItem.findById(item1._id);
            const updatedItem2 = await FoodItem.findById(item2._id);
            expect(updatedItem1!.stock).toBe(95);
            expect(updatedItem2!.stock).toBe(47);
        });
    });

    // ─── Test 2: Insufficient stock ───
    describe('Insufficient Stock', () => {
        it('should return 409 when stock is insufficient', async () => {
            const item = await FoodItem.create({ name: 'Limited Item', stock: 5 });

            await expect(
                stockService.deductStock({
                    orderId: 'order-insufficient-1',
                    items: [{ itemId: item._id.toString(), quantity: 10 }],
                })
            ).rejects.toThrow('Insufficient stock');

            // Verify stock was NOT changed
            const unchanged = await FoodItem.findById(item._id);
            expect(unchanged!.stock).toBe(5);

            // Verify no ProcessedOrder was created
            const processed = await ProcessedOrder.findOne({ orderId: 'order-insufficient-1' });
            expect(processed).toBeNull();
        });
    });

    // ─── Test 3: Duplicate order replay (idempotency) ───
    describe('Duplicate Order Replay', () => {
        it('should return same result for duplicate orderId without double-deducting', async () => {
            const item = await FoodItem.create({ name: 'Idempotent Item', stock: 100 });

            const firstResult = await stockService.deductStock({
                orderId: 'order-idempotent-1',
                items: [{ itemId: item._id.toString(), quantity: 10 }],
            });
            expect(firstResult.status).toBe('success');

            // Second call with same orderId
            const secondResult = await stockService.deductStock({
                orderId: 'order-idempotent-1',
                items: [{ itemId: item._id.toString(), quantity: 10 }],
            });
            expect(secondResult.status).toBe('success');

            // Stock should only be deducted ONCE
            const updated = await FoodItem.findById(item._id);
            expect(updated!.stock).toBe(90);
        });

        it('should return idempotent result even when Redis is bypassed (DB fallback)', async () => {
            const item = await FoodItem.create({ name: 'DB Fallback Item', stock: 100 });

            // First deduction
            await stockService.deductStock({
                orderId: 'order-db-fallback',
                items: [{ itemId: item._id.toString(), quantity: 15 }],
            });

            // Clear Redis to simulate Redis failure/restart
            const { getRedisClient } = require('../src/config/redis');
            const redis = getRedisClient();
            await redis.flushall();

            // Second call — should hit DB fallback
            const replayResult = await stockService.deductStock({
                orderId: 'order-db-fallback',
                items: [{ itemId: item._id.toString(), quantity: 15 }],
            });
            expect(replayResult.status).toBe('success');

            // Stock still only deducted once
            const updated = await FoodItem.findById(item._id);
            expect(updated!.stock).toBe(85);
        });
    });

    // ─── Test 4: Concurrent deduction simulation ───
    describe('Concurrent Deductions', () => {
        it('should handle concurrent requests without overselling', async () => {
            const INITIAL_STOCK = 50;
            const CONCURRENT_REQUESTS = 100;
            const QUANTITY_PER_REQUEST = 1;

            const item = await FoodItem.create({
                name: 'Concurrent Item',
                stock: INITIAL_STOCK,
            });

            // Fire 100 concurrent deduction requests for 1 unit each
            const promises = Array.from({ length: CONCURRENT_REQUESTS }, (_, i) =>
                stockService
                    .deductStock({
                        orderId: `concurrent-order-${i}`,
                        items: [{ itemId: item._id.toString(), quantity: QUANTITY_PER_REQUEST }],
                    })
                    .then(() => 'success' as const)
                    .catch(() => 'failed' as const)
            );

            const results = await Promise.all(promises);

            const successCount = results.filter((r) => r === 'success').length;
            const failedCount = results.filter((r) => r === 'failed').length;

            // Exactly 50 should succeed (matching available stock)
            expect(successCount).toBe(INITIAL_STOCK);
            expect(failedCount).toBe(CONCURRENT_REQUESTS - INITIAL_STOCK);

            // Final stock must be exactly 0 — never negative
            const finalItem = await FoodItem.findById(item._id);
            expect(finalItem!.stock).toBe(0);
            expect(finalItem!.stock).toBeGreaterThanOrEqual(0);
        }, 120000); // Extended timeout for concurrent ops
    });

    // ─── Test 5: Multi-item transactional rollback ───
    describe('Multi-Item Transactional Rollback', () => {
        it('should rollback all items if any single item has insufficient stock', async () => {
            const item1 = await FoodItem.create({ name: 'Rollback Item A', stock: 100 });
            const item2 = await FoodItem.create({ name: 'Rollback Item B', stock: 2 });

            // Order: 5 of item1 + 5 of item2 (item2 only has 2 → should fail)
            await expect(
                stockService.deductStock({
                    orderId: 'order-rollback-1',
                    items: [
                        { itemId: item1._id.toString(), quantity: 5 },
                        { itemId: item2._id.toString(), quantity: 5 },
                    ],
                })
            ).rejects.toThrow('Insufficient stock');

            // BOTH items must be unchanged (transaction rolled back)
            const unchangedItem1 = await FoodItem.findById(item1._id);
            const unchangedItem2 = await FoodItem.findById(item2._id);
            expect(unchangedItem1!.stock).toBe(100);
            expect(unchangedItem2!.stock).toBe(2);

            // No processed order should exist
            const processed = await ProcessedOrder.findOne({ orderId: 'order-rollback-1' });
            expect(processed).toBeNull();
        });
    });
});
