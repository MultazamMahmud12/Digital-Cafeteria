// make sure auth middleware can verify tokens
process.env.JWT_SECRET = 'test_secret';

const request = require('supertest');
const express = require('express');
const orderRoutes = require('../routes/orderRoutes');

// mocks
jest.mock('../config/redis', () => ({
    get: jest.fn(),
    setEx: jest.fn(),
    isOpen: true
}));
const redisClient = require('../config/redis');

jest.mock('axios');
const axios = require('axios');

// build a small express app using the real routes + middleware
const app = express();
app.use(express.json());
app.use('/order', orderRoutes);

// helper to generate a valid JWT for testing (skip actual signing for simplicity)
const jwt = require('jsonwebtoken');
const fakeToken = jwt.sign({ id: 'userId' }, 'test_secret');

describe('orderController.placeOrder validation', () => {
    it('returns 400 if itemId is missing', async () => {
        const res = await request(app)
            .post('/order/place')
            .set('Authorization', `Bearer ${fakeToken}`)
            .send({ quantity: 1 });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toMatch(/itemId/);
    });

    it('returns 400 if quantity is missing', async () => {
        const res = await request(app)
            .post('/order/place')
            .set('Authorization', `Bearer ${fakeToken}`)
            .send({ itemId: 'item1' });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toMatch(/quantity/);
    });

    it('returns 400 if quantity <= 0', async () => {
        const res = await request(app)
            .post('/order/place')
            .set('Authorization', `Bearer ${fakeToken}`)
            .send({ itemId: 'item1', quantity: 0 });
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toMatch(/Quantity must be greater/);
    });
});

describe('orderController.placeOrder cache behavior', () => {
    beforeEach(() => {
        redisClient.get.mockReset();
        redisClient.setEx.mockReset();
    });

    it('fast-rejects when redis says OUT_OF_STOCK', async () => {
        // return OUT_OF_STOCK only for stock_status keys; blacklist check should return null
        redisClient.get.mockImplementation(async (key) => {
            if (key.startsWith('stock_status_')) return 'OUT_OF_STOCK';
            return null;
        });

        const res = await request(app)
            .post('/order/place')
            .set('Authorization', `Bearer ${fakeToken}`)
            .send({ itemId: 'item1', quantity: 2 });
        expect(res.statusCode).toBe(400);
        expect(res.body.status).toBe('OUT_OF_STOCK');
        expect(redisClient.get).toHaveBeenCalledWith('stock_status_item1');
    });

    it('calls stock service and updates cache on success', async () => {
        redisClient.get.mockResolvedValue(null);
        axios.post.mockResolvedValue({
            data: { orderId: 'ord123', remainingStock: 5 }
        });

        const res = await request(app)
            .post('/order/place')
            .set('Authorization', `Bearer ${fakeToken}`)
            .send({ itemId: 'item1', quantity: 2 });

        expect(res.statusCode).toBe(201);
        expect(res.body.orderId).toBe('ord123');
        expect(redisClient.setEx).toHaveBeenCalledWith(
            'stock_status_item1',
            3600,
            'AVAILABLE'
        );
    });

    it('propagates out-of-stock response and updates cache', async () => {
        redisClient.get.mockResolvedValue(null);
        const error = new Error('out of stock');
        error.response = { status: 400, data: { message: 'item out of stock' } };
        axios.post.mockRejectedValue(error);

        const res = await request(app)
            .post('/order/place')
            .set('Authorization', `Bearer ${fakeToken}`)
            .send({ itemId: 'item1', quantity: 2 });

        expect(res.statusCode).toBe(400);
        expect(redisClient.setEx).toHaveBeenCalledWith('stock_status_item1', 3600, 'OUT_OF_STOCK');
    });

    it('returns 503 when stock service is unavailable', async () => {
        redisClient.get.mockResolvedValue(null);
        const err = new Error('ECONNREFUSED');
        err.code = 'ECONNREFUSED';
        axios.post.mockRejectedValue(err);

        const res = await request(app)
            .post('/order/place')
            .set('Authorization', `Bearer ${fakeToken}`)
            .send({ itemId: 'item1', quantity: 2 });

        expect(res.statusCode).toBe(503);
    });
});
