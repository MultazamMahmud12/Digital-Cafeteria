const jwt = require('jsonwebtoken');
const blacklisttokenModel = require('../models/blacklistToken.model');
const User = require('../models/user.model');

module.exports.auth = async (req, res, next) => {
    try {
        // Get token from cookies or Authorization header
        let token = req.cookies?.token;
        const isBlacklisted = await blacklisttokenModel.find({ token });

        if (isBlacklisted.length) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
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
        
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Fetch full user document from database using the user ID from JWT
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({ 
                message: 'User not found' 
            });
        }
        
        // Attach full user document to request object
        req.user = user;
        
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
