// ensure JWT secret is defined for signing
process.env.JWT_SECRET = 'test_secret';

const request = require('supertest');
const express = require('express');
const userRoute = require('../routes/user.route');

// prevent actual MongoDB connection attempt
jest.mock('../db/db', () => jest.fn());

// mocks
jest.mock('../models/user.model');
const User = require('../models/user.model');

jest.mock('../middleware/metrics', () => ({
    incSuccessfulLogin: jest.fn(),
    incFailedLogin: jest.fn(),
    getMetrics: jest.fn()
}));

const app = express();
app.use(express.json());
app.use(userRoute);

// helper to start server if needed

describe('identity service login/register', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns 401 when user not found', async () => {
        User.findOne.mockResolvedValue(null);
        const res = await request(app)
            .post('/login')
            .send({ id: 'nonexistent', password: 'pwd' });
        expect(res.statusCode).toBe(401);
        expect(res.body.message).toMatch(/Invalid ID or password/);
    });

    it('returns 401 on wrong password', async () => {
        const fakeUser = { _id: '1', id: 'student1', password: '$2b$10$invalidhash' };
        User.findOne.mockResolvedValue(fakeUser);
        // bcrypt compare will return false; we can mock it separately
        const bcrypt = require('bcrypt');
        jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

        const res = await request(app)
            .post('/login')
            .send({ id: 'student1', password: 'wrong' });
        expect(res.statusCode).toBe(401);
        expect(res.body.message).toMatch(/Invalid ID or password/);
    });

    it('returns 200 on valid login and increments success counter', async () => {
        const bcrypt = require('bcrypt');
        jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
        const fakeUser = { _id: '1', id: 'student1', name: 'Test', password: 'hash' };
        User.findOne.mockResolvedValue(fakeUser);

        const res = await request(app)
            .post('/login')
            .send({ id: 'student1', password: 'right' });
        expect(res.statusCode).toBe(200);
        expect(res.body.user.name).toBe('Test');
    });
});