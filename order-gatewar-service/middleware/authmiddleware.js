const jwt = require('jsonwebtoken');
const redisClient = require('../config/redis');

module.exports.auth = async (req, res, next) => {
    try {
        // Get token from cookies or Authorization header
        let token = req.cookies?.token;
        
        // If not in cookies, check Authorization header
        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7); // Remove 'Bearer ' prefix
            }
        }
        
        // If no token found
        if (!token) {
            return res.status(401).json({ 
                message: 'Access denied. No token provided.' 
            });
        }
        
        // Check if token is blacklisted in Redis
        const isBlacklistedRedis = await redisClient.get(`blacklist_${token}`);
        if (isBlacklistedRedis) {
            return res.status(401).json({ message: 'Token has been blacklisted' });
        }
        
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Attach decoded user info to request object
        req.user = decoded;
        
        // Continue to next middleware/route handler
        next();
        
    } catch (error) {
        // Handle specific JWT errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                message: 'Invalid token' 
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                message: 'Token expired' 
            });
        }
        
        // Generic error
        return res.status(500).json({ 
            message: 'Internal server error' 
        });
    }
};
