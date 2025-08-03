const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Comprehensive security headers
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: true,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: "no-referrer" },
  xssFilter: true
});

// Enhanced rate limiting
const createRateLimit = (windowMs, max, skipSuccessful = true) => {
  return rateLimit({
    windowMs,
    max,
    skipSuccessful,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: 'Too many requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

const rateLimits = {
  // Authentication endpoints - very strict
  auth: createRateLimit(15 * 60 * 1000, 5, false), // 5 attempts per 15 minutes
  
  // Password reset - strict
  passwordReset: createRateLimit(60 * 60 * 1000, 3, false), // 3 attempts per hour
  
  // General API - moderate
  api: createRateLimit(15 * 60 * 1000, 100), // 100 requests per 15 minutes
  
  // File upload - restrictive
  upload: createRateLimit(60 * 60 * 1000, 10), // 10 uploads per hour
  
  // Search - moderate
  search: createRateLimit(60 * 1000, 30) // 30 searches per minute
};

module.exports = {
  securityHeaders,
  rateLimits
};