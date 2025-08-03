const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const MongoStore = require('rate-limit-mongo');

// Rate limiting configurations
const createRateLimiter = (windowMs, max, message, skipSuccessfulRequests = false) => {
  const store = process.env.MONGODB_URI 
    ? MongoStore.create({
        uri: process.env.MONGODB_URI,
        collectionName: 'rateLimits',
        expireTimeMs: windowMs
      })
    : undefined; // Use memory store for development

  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: message,
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    store,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.round(windowMs / 1000)
      });
    }
  });
};

// Different rate limits for different endpoints
const rateLimits = {
  // Authentication endpoints - very strict
  auth: createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    5, // 5 attempts
    'Too many authentication attempts, please try again later',
    false
  ),
  
  // Registration - prevent spam accounts
  register: createRateLimiter(
    60 * 60 * 1000, // 1 hour
    3, // 3 registrations per hour
    'Too many registration attempts, please try again later',
    false
  ),
  
  // Password reset - prevent abuse
  passwordReset: createRateLimiter(
    60 * 60 * 1000, // 1 hour
    3, // 3 attempts per hour
    'Too many password reset attempts, please try again later',
    false
  ),
  
  // API endpoints - moderate limits
  api: createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    100, // 100 requests
    'Too many API requests, please slow down',
    true
  ),
  
  // Post creation - prevent spam
  createPost: createRateLimiter(
    60 * 1000, // 1 minute
    5, // 5 posts per minute
    'Too many posts created, please slow down',
    false
  ),
  
  // File uploads - very limited
  upload: createRateLimiter(
    60 * 1000, // 1 minute
    3, // 3 uploads per minute
    'Too many file uploads, please slow down',
    false
  )
};

// Security headers configuration
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com", "https://unpkg.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Request logger middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    };
    
    if (res.statusCode >= 400) {
      console.error('Request Error:', logData);
    } else {
      console.log('Request:', logData);
    }
  });
  
  next();
};

module.exports = {
  rateLimits,
  securityHeaders,
  corsOptions,
  requestLogger
};