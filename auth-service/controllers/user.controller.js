const User = require('../models/user.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const BlacklistToken = require('../models/blacklistToken.model');
const redisClient = require('../db/redis');
const { incSuccessfulLogin, incFailedLogin, getMetrics } = require('../middleware/metrics');
const register = async (req,res) => {
    try {
        const { name, id, password } = req.body;
        const userExists = await User.findOne({ id });
        if(userExists){
            return res.status(400).json({message : "User already exists"})
        }
        const hashedPassword = await bcrypt.hash(password,10);
        const newUser = new User ({
            name,
            id,
            password : hashedPassword
        })
        await newUser.save();

        const token = jwt.sign({id : newUser._id},process.env.JWT_SECRET,{expiresIn : '1h'});
        res.cookie('token',token,{httpOnly : true});
        res.status(201).json({
            message : "User registered successfully",
            token,
            user:{
                id : newUser.id,
                name : newUser.name,
                dbId: newUser._id
            }

        });
        
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({message : "Internal server error", error: error.message})
    }
}

const login = async (req,res) => {
    try {
        const { id, password } = req.body;
        
        // Check if user exists by student ID
        const userExists = await User.findOne({ id });
        if (!userExists) {
            incFailedLogin();
            return res.status(401).json({ message: "Invalid ID or password" });
        }
        
        // Compare password
        const isPasswordValid = await bcrypt.compare(password, userExists.password);
        if (!isPasswordValid) {
            incFailedLogin();
            return res.status(401).json({ message: "Invalid ID or password" });
        }
        
        // Generate JWT token
        const token = jwt.sign({ id: userExists._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        
        // Set cookie
        res.cookie('token', token, { httpOnly: true });
        
        incSuccessfulLogin();
        res.status(200).json({ 
            message: "Login successful", 
            token,
            user:{
                id : userExists._id,
                name : userExists.name
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
}

const logout = async (req, res) => {
    try {
        // read token first (cookie-parser must be enabled in app)
        const token = req.cookies?.token;
        
        if (!token) {
            return res.status(400).json({ message: "No token provided" });
        }
        
        // Verify token to get expiration time
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const now = Math.floor(Date.now() / 1000);
        const timeLeft = decoded.exp - now;

        // Add to MongoDB blacklist for persistence
        await BlacklistToken.create({ token });

        // Add to Redis with TTL (Time To Live)
        // This means Redis will automatically delete it once the token expires
        if (timeLeft > 0) {
            await redisClient.setEx(`blacklist_${token}`, timeLeft, 'true');
        }

        res.clearCookie('token');
        res.status(200).json({ message: "Logout successful" });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
}


const profile = async (req, res) => {
     try {
        res.status(200).json({
            message: "Profile retrieved successfully",
            user: {
                
                id: req.user.id,
                name: req.user.name
            }
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ message: error.message });
    }
}

const health = async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            return res.status(200).json({ status: 'healthy', message: 'MongoDB connected' });
        }
        else   return res.status(503).json({ status: 'unhealthy', message: 'MongoDB not connected' });
        
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });

        
    }
    
}

// `/metrics` endpoint simply delegates to the Prometheus module
const metric = (req, res) => {
    getMetrics(req, res);
};
module.exports = {
    register,
    login,
    logout,
    profile,
    health,
    metric
}