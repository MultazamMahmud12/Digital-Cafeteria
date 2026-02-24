const express = require('express');
const expressProxy = require('express-http-proxy');
const app = express();
const dotenv = require('dotenv');
const redisClient = require('./config/redis');
const orderRoutes = require('./routes/orderRoutes');

dotenv.config();

// Don't wait for Redis to connect - app starts regardless
// redisClient.connect() is handled internally with fallback

app.use(express.json());

// Routes
app.use('/user', expressProxy('http://localhost:3001'));
app.use('/order', orderRoutes);

app.listen(3000, () => { console.log("Gateway is running on port 3000") })