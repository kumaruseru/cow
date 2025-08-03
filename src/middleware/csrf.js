const csrf = require('csrf');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Initialize CSRF token generator
const tokens = new csrf();

// Generate a secret key for CSRF tokens
const getSecret = () => {
  if (!global.csrfSecret) {
    global.csrfSecret = tokens.secretSync();
  }
  return global.csrfSecret;
};

// CSRF protection middleware with new secure implementation
const csrfProtection = (req, res, next) => {
  try {
    // Skip CSRF check for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      // Add CSRF token generation for safe requests
      req.csrfToken = () => tokens.create(getSecret());
      return next();
    }

    // Get token from various sources
    const token =
      req.body._csrf ||
      req.query._csrf ||
      req.headers['csrf-token'] ||
      req.headers['xsrf-token'] ||
      req.headers['x-csrf-token'] ||
      req.headers['x-xsrf-token'];

    if (!token) {
      logger.warn('CSRF token missing', {
        userId: req.user?.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        url: req.originalUrl
      });

      return res.status(403).json({
        success: false,
        error: 'CSRF token required',
        code: 'CSRF_MISSING'
      });
    }

    // Verify the token
    const isValid = tokens.verify(getSecret(), token);

    if (!isValid) {
      logger.warn('CSRF token validation failed', {
        userId: req.user?.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        url: req.originalUrl
      });

      return res.status(403).json({
        success: false,
        error: 'Invalid CSRF token',
        code: 'CSRF_INVALID'
      });
    }

    // Add token generation method for valid requests
    req.csrfToken = () => tokens.create(getSecret());
    next();
  } catch (error) {
    logger.error('CSRF validation error:', error);
    res.status(500).json({
      success: false,
      error: 'CSRF validation failed'
    });
  }
};

// Rate limiting for CSRF token requests
const csrfTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    error: 'Too many CSRF token requests',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: req => {
    // Skip rate limiting for authenticated API requests
    return req.path.startsWith('/api/') && req.user;
  }
});

// CSRF token endpoint
const getCsrfToken = (req, res) => {
  try {
    const token = req.csrfToken();

    logger.info('CSRF token generated', {
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      csrfToken: token
    });
  } catch (error) {
    logger.error('CSRF token generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate CSRF token'
    });
  }
};

// Origin validation middleware
const validateOrigin = (req, res, next) => {
  try {
    const origin = req.get('Origin');
    const referer = req.get('Referer');
    const host = req.get('Host');

    // Allow same-origin requests
    const allowedOrigins = [`http://${host}`, `https://${host}`, process.env.FRONTEND_URL].filter(
      Boolean
    );

    // Skip origin check for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // Check origin header
    if (origin && !allowedOrigins.includes(origin)) {
      logger.warn('Invalid origin detected', {
        origin,
        host,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return res.status(403).json({
        success: false,
        error: 'Invalid origin'
      });
    }

    // Check referer header as fallback
    if (!origin && referer) {
      const refererOrigin = new URL(referer).origin;
      if (!allowedOrigins.includes(refererOrigin)) {
        logger.warn('Invalid referer detected', {
          referer,
          refererOrigin,
          host,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        return res.status(403).json({
          success: false,
          error: 'Invalid referer'
        });
      }
    }

    next();
  } catch (error) {
    logger.error('Origin validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Origin validation failed'
    });
  }
};

// Content Security Policy middleware
const cspMiddleware = (req, res, next) => {
  // Set CSP headers
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self' wss:",
      "media-src 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  );

  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

  next();
};

// CSRF error handler
const csrfErrorHandler = (err, req, res, next) => {
  if (err && (err.code === 'EBADCSRFTOKEN' || err.message?.includes('CSRF'))) {
    logger.warn('CSRF error occurred', {
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      error: err.message,
      code: err.code
    });

    return res.status(403).json({
      success: false,
      error: 'CSRF validation failed',
      code: 'CSRF_ERROR'
    });
  }

  next(err);
};

module.exports = {
  csrfProtection,
  csrfTokenLimiter,
  getCsrfToken,
  validateOrigin,
  cspMiddleware,
  csrfErrorHandler
};
