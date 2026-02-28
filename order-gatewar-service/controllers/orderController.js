const axios = require('axios');
const redisClient = require('../config/redis');

/**
 * STEP 1: Identity Layer (JWT Check + Blacklist) - Handled by auth middleware
 * STEP 2: Binary Stock Gate (Redis Check) - Fast Reject if OUT_OF_STOCK
 * STEP 3: Handover (Axios Call to Stock Service) - Get real inventory confirmation
 * STEP 4: Response Loop (Handle success/error & update cache)
 */

const placeOrder = async (req, res) => {
    try {
        const { itemId, quantity } = req.body;
        const userId = req.user.id; // From JWT token

        // Validate input
        // note: quantity 0 is not `== null`, but we still want to reject non-positive
        if (!itemId || quantity == null) {
            return res.status(400).json({ 
                message: "itemId and quantity are required" 
            });
        }

        if (quantity <= 0) {
            return res.status(400).json({ 
                message: "Quantity must be greater than 0" 
            });
        }

        console.log(`[Order] User ${userId} requesting ${quantity} of item ${itemId}`);

        // ============================================
        // STEP 2: Fast Reject - Check Redis Stock Gate
        // ============================================
        const stockStatusKey = `stock_status_${itemId}`;
        let stockStatus = null;
        
        try {
            stockStatus = await redisClient.get(stockStatusKey);
            console.log(`[Redis] Stock status for item ${itemId}: ${stockStatus || 'NOT_CACHED'}`);
        } catch (redisError) {
            console.log(`[Redis] Cache unavailable: ${redisError.message}`);
            // Continue without cache hit - will check with Stock Service
        }

        if (stockStatus === 'OUT_OF_STOCK') {
            console.log(`[Fast Reject] Item ${itemId} is OUT_OF_STOCK in cache`);
            return res.status(400).json({ 
                message: "Item is out of stock",
                status: "OUT_OF_STOCK"
            });
        }

        // ============================================
        // STEP 3: Handover - Call Stock Service
        // ============================================
        console.log(`[Axios] Calling Stock Service to place order...`);
        
        const orderResponse = await axios.post(
            `${process.env.STOCK_SERVICE_URL}/order`,
            {
                userId,
                itemId,
                quantity
            },
            { timeout: 5000 } // 5 second timeout
        );

        console.log(`[Success] Order placed. Response:`, orderResponse.data);

        // ============================================
        // STEP 4: Response Loop - Update cache & return
        // ============================================
        // If Stock Service confirms order, update Redis to reflect availability
        if (orderResponse.data.remainingStock !== undefined) {
            try {
                if (orderResponse.data.remainingStock <= 0) {
                    await redisClient.setEx(stockStatusKey, 3600, 'OUT_OF_STOCK');
                    console.log(`[Cache Update] Item ${itemId} marked OUT_OF_STOCK`);
                } else {
                    // Keep availability status (optional: store remaining qty too)
                    await redisClient.setEx(stockStatusKey, 3600, 'AVAILABLE');
                    console.log(`[Cache Update] Item ${itemId} still AVAILABLE`);
                }
            } catch (redisError) {
                console.log(`[Cache Update] Redis unavailable, skipping cache update: ${redisError.message}`);
            }
        }

        res.status(201).json({
            message: "Order placed successfully",
            orderId: orderResponse.data.orderId,
            itemId,
            quantity,
            remainingStock: orderResponse.data.remainingStock
        });

    } catch (error) {
        console.error('[Order Error]:', error.message);

        // ============================================
        // Error Handling - Update Redis if needed
        // ============================================
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;

            // If Stock Service says item is out of stock, update our cache
            if (status === 400 && data.message?.includes('out of stock')) {
                try {
                    console.log(`[Stock Service] Item is OUT_OF_STOCK - updating cache`);
                    await redisClient.setEx(`stock_status_${req.body.itemId}`, 3600, 'OUT_OF_STOCK');
                } catch (redisError) {
                    console.log(`[Cache] Could not update Redis: ${redisError.message}`);
                }
            }

            return res.status(status).json({
                message: data.message || "Order failed",
                error: data.error
            });
        }

        // Timeout or connection error
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return res.status(503).json({
                message: "Stock Service is unavailable. Please try again later.",
                error: error.message
            });
        }

        res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    }
};

const getOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.user.id;

        if (!orderId) {
            return res.status(400).json({ message: "orderId is required" });
        }

        console.log(`[Status] User ${userId} checking status of order ${orderId}`);

        // Call Stock Service to get order status
        const statusResponse = await axios.get(
            `${process.env.STOCK_SERVICE_URL}/order/${orderId}`,
            { timeout: 5000 }
        );

        res.status(200).json(statusResponse.data);

    } catch (error) {
        console.error('[Status Error]:', error.message);

        if (error.response?.status === 404) {
            return res.status(404).json({ message: "Order not found" });
        }

        if (error.response) {
            return res.status(error.response.status).json(error.response.data);
        }

        res.status(503).json({
            message: "Stock Service is unavailable",
            error: error.message
        });
    }
};

module.exports = {
    placeOrder,
    getOrderStatus
};
