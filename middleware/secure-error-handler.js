const logger = require('../utils/logger');

// Enhanced error handling middleware
const secureErrorHandler = (err, req, res, next) => {
  // Log full error details for internal use
  logger.error('Application error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    user: req.user?.id || 'anonymous',
    timestamp: new Date().toISOString()
  });

  // Determine error status code
  let statusCode = err.statusCode || err.status || 500;
  
  // Security-conscious error response
  const errorResponse = {
    success: false,
    timestamp: new Date().toISOString(),
    path: req.url,
    method: req.method
  };

  // Handle specific error types
  switch (err.name) {
    case 'ValidationError':
      statusCode = 400;
      errorResponse.error = 'Validation failed';
      errorResponse.code = 'VALIDATION_ERROR';
      if (process.env.NODE_ENV === 'development') {
        errorResponse.details = err.errors;
      }
      break;

    case 'CastError':
      statusCode = 400;
      errorResponse.error = 'Invalid data format';
      errorResponse.code = 'INVALID_FORMAT';
      break;

    case 'MongoServerError':
      if (err.code === 11000) {
        statusCode = 409;
        errorResponse.error = 'Resource already exists';
        errorResponse.code = 'DUPLICATE_RESOURCE';
      } else {
        statusCode = 500;
        errorResponse.error = 'Database error';
        errorResponse.code = 'DATABASE_ERROR';
      }
      break;

    case 'JsonWebTokenError':
      statusCode = 401;
      errorResponse.error = 'Invalid authentication token';
      errorResponse.code = 'INVALID_TOKEN';
      break;

    case 'TokenExpiredError':
      statusCode = 401;
      errorResponse.error = 'Authentication token expired';
      errorResponse.code = 'TOKEN_EXPIRED';
      break;

    case 'MulterError':
      statusCode = 400;
      if (err.code === 'LIMIT_FILE_SIZE') {
        errorResponse.error = 'File too large';
        errorResponse.code = 'FILE_TOO_LARGE';
      } else if (err.code === 'LIMIT_FILE_COUNT') {
        errorResponse.error = 'Too many files';
        errorResponse.code = 'TOO_MANY_FILES';
      } else {
        errorResponse.error = 'File upload error';
        errorResponse.code = 'UPLOAD_ERROR';
      }
      break;

    default:
      // Generic server error
      if (statusCode >= 500) {
        errorResponse.error = 'Internal server error';
        errorResponse.code = 'INTERNAL_ERROR';
      } else {
        errorResponse.error = err.message || 'Bad request';
        errorResponse.code = err.code || 'BAD_REQUEST';
      }
  }

  // Only include sensitive details in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.details = {
      name: err.name,
      message: err.message,
      ...(err.errors && { validationErrors: err.errors })
    };
  }

  // Security headers for error responses
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  });

  res.status(statusCode).json(errorResponse);
};

// 404 handler
const notFoundHandler = (req, res) => {
  logger.warn('404 Not Found:', {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json({
    success: false,
    error: 'Resource not found',
    code: 'NOT_FOUND',
    timestamp: new Date().toISOString(),
    path: req.url
  });
};

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Request timeout handler
const timeoutHandler = (timeout = 30000) => (req, res, next) => {
  const timer = setTimeout(() => {
    const error = new Error('Request timeout');
    error.statusCode = 408;
    error.code = 'REQUEST_TIMEOUT';
    next(error);
  }, timeout);

  res.on('finish', () => {
    clearTimeout(timer);
  });

  res.on('close', () => {
    clearTimeout(timer);
  });

  next();
};

module.exports = {
  secureErrorHandler,
  notFoundHandler,
  asyncHandler,
  timeoutHandler
};