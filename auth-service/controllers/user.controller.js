const User = require('../models/user.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const BlacklistToken = require('../models/blacklistToken.model');
const { incSuccessfulLogin, incFailedLogin } = require('../middleware/metrics');
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
        const { email, password } = req.body;
        
        // Check if user exists
        const userExists = await User.findOne({ email });
        if (!userExists) {
            incFailedLogin();
            return res.status(401).json({ message: "Invalid email or password" });
        }
        
        // Compare password
        const isPasswordValid = await bcrypt.compare(password, userExists.password);
        if (!isPasswordValid) {
            incFailedLogin();
            return res.status(401).json({ message: "Invalid email or password" });
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
                name : userExists.name,
                email : userExists.email
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
        if (token) {
            await BlacklistToken.create({ token });
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

const metric = async (req, res) => {
    try {
        const metrics = getMetrics();
        res.status(200).json(metrics);
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
module.exports = {
    register,
    login,
    logout,
    profile,
    health,
    metric
}