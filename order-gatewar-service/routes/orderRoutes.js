const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/authmiddleware');
const orderController = require('../controllers/orderController');

/**
 * Order Gateway Routes
 */

// Frontend-compatible route
router.post('/', auth, orderController.placeOrder);

// Place a new order (requires authentication)
router.post('/place', auth, orderController.placeOrder);

// Get order status (requires authentication)
router.get('/status/:orderId', auth, orderController.getOrderStatus);

module.exports = router;
