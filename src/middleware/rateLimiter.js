const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Helper function to create basic rate limiter
const createRateLimiter = (windowMs, max, message, skipSuccessfulRequests = false) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded from IP: ${req.ip} for route: ${req.originalUrl}`);
      res.status(429).json({ error: message });
    }
  });
};

// Strict rate limiting for authentication routes
const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts
  'Too many authentication attempts, please try again later'
);

// Password reset rate limiting
const passwordResetLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  3, // 3 attempts
  'Too many password reset attempts, please try again later'
);

// Two-factor authentication rate limiting
const twoFactorLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  10, // 10 attempts
  'Too many 2FA attempts, please try again later'
);

// Search rate limiting
const searchLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  30, // 30 searches
  'Too many search requests, please slow down'
);

// Post creation rate limiting
const postLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  20, // 20 posts
  'Too many posts created, please wait before posting again'
);

// File upload rate limiting
const uploadLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  10, // 10 uploads
  'Too many file uploads, please wait before uploading again'
);

// Message sending rate limiting
const messageLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  60, // 60 messages
  'Too many messages sent, please slow down'
);

// Friend request rate limiting
const friendRequestLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  50, // 50 friend requests
  'Too many friend requests sent, please wait before sending more'
);

module.exports = {
  authLimiter,
  passwordResetLimiter,
  twoFactorLimiter,
  searchLimiter,
  postLimiter,
  uploadLimiter,
  messageLimiter,
  friendRequestLimiter
};
