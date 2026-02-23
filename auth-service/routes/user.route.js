const express = require('express');
const router = express.Router();
const userController =require('../controllers/user.controller');
const authMiddleware = require('../middleware/authmiddleware');
const mongoose = require('mongoose');
const { getMetrics } = require('../middleware/metrics');
const loginLimiter = require('../middleware/rateLimiter');

// Health check endpoint
router.get('/health', userController.health);

// Metrics endpoint
router.get('/metrics', userController.metric);

router.post('/register',userController.register); 
router.post('/login', loginLimiter, userController.login);
router.post('/logout', userController.logout);
router.get('/profile',authMiddleware.auth,userController.profile);

module.exports = router;