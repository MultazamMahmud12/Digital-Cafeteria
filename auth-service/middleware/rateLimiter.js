const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 3, // Limit each studentID to 3 requests per window
  message: { message: "Too many login attempts. Try again in a minute." },
  keyGenerator: (req) => {
    return req.body.id || req.body.studentID || req.ip; // Use studentID if available, fallback to IP
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting if no student ID is provided
    return !req.body.id && !req.body.studentID;
  },
  handler: (req, res) => {
    res.status(429).json({
      message: "Too many login attempts. Try again in a minute.",
      retryAfter: req.rateLimit.resetTime
    });
  }
});

module.exports = loginLimiter;
