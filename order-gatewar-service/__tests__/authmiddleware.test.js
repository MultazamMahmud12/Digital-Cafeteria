// define secret for token creation
process.env.JWT_SECRET = 'test_secret';

const express = require('express');
const request = require('supertest');

// we will import the middleware after mocking redis
jest.mock('../config/redis', () => ({
    get: jest.fn(),
    isOpen: true
}));
const redisClient = require('../config/redis');

const { auth } = require('../middleware/authmiddleware');
const jwt = require('jsonwebtoken');
const SECRET = 'test_secret';

// a simple express app with the middleware applied to a test route
const app = express();
app.get('/protected', auth, (req, res) => res.status(200).json({ ok: true }));

describe('auth middleware', () => {
    it('rejects when no token provided', async () => {
        const res = await request(app).get('/protected');
        expect(res.statusCode).toBe(401);
        expect(res.body.message).toMatch(/No token/);
    });

    it('rejects invalid token', async () => {
        const res = await request(app)
            .get('/protected')
            .set('Authorization', 'Bearer invalid');
        expect(res.statusCode).toBe(401);
        expect(res.body.message).toMatch(/Invalid token/);
    });

    it('rejects expired token', async () => {
        // create a token that is already expired
        const token = jwt.sign({ id: 'user' }, SECRET, { expiresIn: '-1h' });
        const res = await request(app)
            .get('/protected')
            .set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(401);
        expect(res.body.message).toMatch(/expired/);
    });

    it('rejects blacklisted token (redis)', async () => {
        const token = jwt.sign({ id: 'user' }, SECRET, { expiresIn: '1h' });
        redisClient.get.mockResolvedValue('true');
        const res = await request(app)
            .get('/protected')
            .set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(401);
        expect(res.body.message).toMatch(/blacklisted/);
    });

    it('allows valid token and attaches user', async () => {
        const token = jwt.sign({ id: 'user' }, SECRET, { expiresIn: '1h' });
        redisClient.get.mockResolvedValue(null);
        const res = await request(app)
            .get('/protected')
            .set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ ok: true });
    });
});
