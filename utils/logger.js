const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Custom format for logs
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta
    });
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'cow-social-network' },
  transports: [
    // Error logs
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: process.env.LOG_FILE_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_FILE_MAX_FILES || '14d'
    }),
    
    // Combined logs
    new DailyRotateFile({
      filename: path.join(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: process.env.LOG_FILE_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_FILE_MAX_FILES || '14d'
    }),
    
    // Security logs
    new DailyRotateFile({
      filename: path.join(logDir, 'security-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'warn',
      maxSize: process.env.LOG_FILE_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_FILE_MAX_FILES || '30d'
    })
  ],
  
  // Handle exceptions and rejections
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(logDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: process.env.LOG_FILE_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_FILE_MAX_FILES || '14d'
    })
  ],
  
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(logDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: process.env.LOG_FILE_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_FILE_MAX_FILES || '14d'
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Custom logging methods for specific purposes
const securityLogger = {
  loginAttempt: (email, success, ip, userAgent) => {
    logger.warn('Login attempt', {
      type: 'auth',
      email,
      success,
      ip,
      userAgent,
      timestamp: new Date().toISOString()
    });
  },
  
  failedLogin: (email, ip, userAgent, reason) => {
    logger.warn('Failed login attempt', {
      type: 'auth_failure',
      email,
      ip,
      userAgent,
      reason,
      timestamp: new Date().toISOString()
    });
  },
  
  rateLimitExceeded: (ip, endpoint, userAgent) => {
    logger.warn('Rate limit exceeded', {
      type: 'rate_limit',
      ip,
      endpoint,
      userAgent,
      timestamp: new Date().toISOString()
    });
  },
  
  suspiciousActivity: (userId, activity, details) => {
    logger.warn('Suspicious activity detected', {
      type: 'suspicious_activity',
      userId,
      activity,
      details,
      timestamp: new Date().toISOString()
    });
  }
};

// Performance logger
const performanceLogger = {
  slowQuery: (query, duration, collection) => {
    logger.warn('Slow database query', {
      type: 'performance',
      query,
      duration,
      collection,
      timestamp: new Date().toISOString()
    });
  },
  
  slowRequest: (method, url, duration, statusCode) => {
    logger.warn('Slow HTTP request', {
      type: 'performance',
      method,
      url,
      duration,
      statusCode,
      timestamp: new Date().toISOString()
    });
  }
};

// Add custom methods to main logger
logger.security = securityLogger;
logger.performance = performanceLogger;

module.exports = logger;
