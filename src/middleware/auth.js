const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

// Protect routes - require authentication
const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Check for token in cookies
    else if (req.cookies.token) {
      token = req.cookies.token;
    }

    // Make sure token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from database
      const user = await User.findById(decoded.id).select('+password');

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'No user found with this token'
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          error: 'Account has been deactivated'
        });
      }

      // Check if user is banned
      if (user.isBanned) {
        return res.status(401).json({
          success: false,
          error: 'Account has been banned'
        });
      }

      // Check if user is locked
      if (user.isLocked) {
        return res.status(401).json({
          success: false,
          error: 'Account is temporarily locked due to too many failed login attempts'
        });
      }

      // Check if user changed password after the token was issued
      if (user.changedPasswordAfter(decoded.iat)) {
        return res.status(401).json({
          success: false,
          error: 'User recently changed password. Please log in again'
        });
      }

      // Check if token is in blacklist (revoked)
      if (user.revokedTokens && user.revokedTokens.includes(token)) {
        return res.status(401).json({
          success: false,
          error: 'Token has been revoked'
        });
      }

      // Check token expiration with additional security
      const currentTime = Math.floor(Date.now() / 1000);
      if (decoded.exp <= currentTime) {
        return res.status(401).json({
          success: false,
          error: 'Token has expired'
        });
      }

      // Update last active
      user.updateLastActive();

      // Grant access to protected route
      req.user = user;
      next();
    } catch (err) {
      logger.error('JWT verification failed:', err.message);
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    logger.error('Auth middleware error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};

// Optional authentication - doesn't require login but adds user if authenticated
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.token) {
      token = req.cookies.token;
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (user && user.isActive && !user.isBanned && !user.isLocked) {
          if (!user.changedPasswordAfter(decoded.iat)) {
            req.user = user;
            user.updateLastActive();
          }
        }
      } catch (err) {
        // Invalid token, but continue without user
        logger.warn('Optional auth failed:', err.message);
      }
    }

    next();
  } catch (error) {
    logger.error('Optional auth middleware error:', error.message);
    next();
  }
};

// Check if user owns resource or is admin
const ownerOrAdmin = (req, res, next) => {
  if (req.user.role === 'admin' || req.user._id.toString() === req.params.userId) {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: 'Not authorized to access this resource'
  });
};

// Rate limiting for authentication endpoints
const authRateLimit = require('express-rate-limit')({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs for auth routes
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: req => {
    // Skip rate limiting for successful requests
    return res.statusCode < 400;
  }
});

module.exports = {
  protect,
  authorize,
  optionalAuth,
  ownerOrAdmin,
  authRateLimit
};
