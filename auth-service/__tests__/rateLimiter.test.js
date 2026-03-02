// ensure JWT secret
process.env.JWT_SECRET = 'test_secret';

const request = require('supertest');
const express = require('express');
const userRoute = require('../routes/user.route');

// mocks to avoid Mongo and bcrypt delays
jest.mock('../db/db', () => jest.fn());
jest.mock('../models/user.model');
const User = require('../models/user.model');

const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());
app.use(userRoute);

jest.setTimeout(20000);

describe('login rate limiter', () => {
    beforeEach(() => {
        // make findOne always resolve quickly (user does not exist)
        User.findOne.mockResolvedValue(null);
        jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);
    });

    it('blocks the 4th attempt within a minute', async () => {
        for (let i = 1; i <= 3; i++) {
            const res = await request(app)
                .post('/login')
                .send({ id: 'student1', password: 'pwd' });
            expect(res.statusCode).not.toBe(429);
        }
        const res4 = await request(app)
            .post('/login')
            .send({ id: 'student1', password: 'pwd' });
        expect(res4.statusCode).toBe(429);
    });
});