// Integrated Security Middleware for Cow Social Network
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const cors = require('cors');
const compression = require('compression');

// Import our custom security modules
const { securityHeaders, rateLimits } = require('./enhanced-security');
const { sanitizeInput, validationRules, handleValidationErrors } = require('./enhanced-validation');
const { secureErrorHandler, notFoundHandler, asyncHandler, timeoutHandler } = require('./secure-error-handler');

// Comprehensive security middleware stack
const applySecurityMiddleware = (app) => {
  // 1. Trust proxy for proper IP detection
  app.set('trust proxy', 1);

  // 2. Request timeout protection
  app.use(timeoutHandler(30000));

  // 3. Compression (before other middleware)
  app.use(compression());

  // 4. Security headers (Helmet.js)
  app.use(securityHeaders);

  // 5. CORS configuration
  const corsOptions = {
    origin: function (origin, callback) {
      const allowedOrigins = process.env.CORS_ORIGIN 
        ? process.env.CORS_ORIGIN.split(',')
        : ['http://localhost:3000', 'http://localhost:3001'];
      
      // Allow requests with no origin (mobile apps, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    maxAge: 86400 // 24 hours
  };
  app.use(cors(corsOptions));

  // 6. Body parsing with security limits
  app.use(express.json({ 
    limit: process.env.MAX_JSON_SIZE || '10mb',
    verify: (req, res, buf) => {
      try {
        JSON.parse(buf);
      } catch (e) {
        const error = new Error('Invalid JSON payload');
        error.statusCode = 400;
        error.code = 'INVALID_JSON';
        throw error;
      }
    }
  }));
  
  app.use(express.urlencoded({ 
    extended: true, 
    limit: process.env.MAX_FORM_SIZE || '10mb' 
  }));

  // 7. Input sanitization
  app.use(mongoSanitize());
  app.use(hpp()); // Prevent HTTP Parameter Pollution
  app.use(sanitizeInput);

  // 8. Apply rate limiting
  app.use('/api/auth/', rateLimits.auth);
  app.use('/api/auth/reset-password', rateLimits.passwordReset);
  app.use('/api/upload/', rateLimits.upload);
  app.use('/api/search/', rateLimits.search);
  app.use('/api/', rateLimits.api);

  console.log('🛡️ Security middleware applied successfully');
};

// Apply validation to routes
const applyValidationRules = (app) => {
  // Authentication routes
  app.use('/api/auth/register', validationRules.register, handleValidationErrors);
  app.use('/api/auth/login', validationRules.login, handleValidationErrors);
  
  // Post routes
  app.use('/api/posts', validationRules.createPost, handleValidationErrors);
  
  // Message routes
  app.use('/api/messages', validationRules.sendMessage, handleValidationErrors);
  
  // File upload routes
  app.use('/api/upload', validationRules.fileUpload, handleValidationErrors);
  
  // Search routes
  app.use('/api/search', validationRules.search, handleValidationErrors);

  console.log('✅ Validation rules applied to routes');
};

// Apply error handling
const applyErrorHandling = (app) => {
  // 404 handler for API routes
  app.use('/api/*', notFoundHandler);
  
  // Global error handler
  app.use(secureErrorHandler);

  console.log('❌ Error handling middleware applied');
};

module.exports = {
  applySecurityMiddleware,
  applyValidationRules,
  applyErrorHandling,
  asyncHandler,
  securityHeaders,
  rateLimits
};