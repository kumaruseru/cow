const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

let winston;
let DailyRotateFile;
try {
  winston = require('winston');
  DailyRotateFile = require('winston-daily-rotate-file');
} catch (error) {
  console.warn('Winston packages not installed, using fallback logger');
}

// Simple fallback logger for when winston is not available
const createFallbackLogger = () => ({
  info: (message, meta = {}) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] INFO: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
    console.log(logMessage);

    try {
      const logFile = path.join(logDir, 'combined.log');
      fs.appendFileSync(logFile, logMessage + '\n');
    } catch (e) {
      /* Ignore file write errors */
    }
  },

  error: (message, meta = {}) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ERROR: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
    console.error(logMessage);

    try {
      const logFile = path.join(logDir, 'error.log');
      fs.appendFileSync(logFile, logMessage + '\n');
    } catch (e) {
      /* Ignore file write errors */
    }
  },

  warn: (message, meta = {}) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] WARN: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
    console.warn(logMessage);

    try {
      const logFile = path.join(logDir, 'combined.log');
      fs.appendFileSync(logFile, logMessage + '\n');
    } catch (e) {
      /* Ignore file write errors */
    }
  },

  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV === 'development') {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] DEBUG: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
      console.log(logMessage);
    }
  },

  stream: {
    write: function (message, encoding) {
      console.log(message.trim());
    }
  }
});

// Create logger instance
let logger;

if (winston && DailyRotateFile) {
  // Define enhanced log format with correlation IDs
  const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, service, correlationId, userId, ...meta }) => {
      let logMessage = `[${timestamp}] ${level.toUpperCase()}`;
      if (correlationId) logMessage += ` [${correlationId}]`;
      if (userId) logMessage += ` [User:${userId}]`;
      logMessage += `: ${message}`;
      
      if (Object.keys(meta).length > 0) {
        logMessage += ` ${JSON.stringify(meta)}`;
      }
      
      return logMessage;
    })
  );

  // Create daily rotating file transport for errors
  const errorRotateTransport = new DailyRotateFile({
    filename: path.join(logDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '30d',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  });

  // Create daily rotating file transport for all logs
  const combinedRotateTransport = new DailyRotateFile({
    filename: path.join(logDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  });

  // Create daily rotating file transport for security events
  const securityRotateTransport = new DailyRotateFile({
    filename: path.join(logDir, 'security-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'warn',
    maxSize: '20m',
    maxFiles: '90d', // Keep security logs longer
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  });

  // Create logger instance with enhanced configuration
  logger = winston.createLogger({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info'),
    format: logFormat,
    defaultMeta: { 
      service: 'cow-social-network',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    },
    transports: [
      errorRotateTransport,
      combinedRotateTransport,
      securityRotateTransport
    ],
    exceptionHandlers: [
      new DailyRotateFile({
        filename: path.join(logDir, 'exceptions-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d'
      })
    ],
    rejectionHandlers: [
      new DailyRotateFile({
        filename: path.join(logDir, 'rejections-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d'
      })
    ]
  });

  // Add console transport for development
  if (process.env.NODE_ENV !== 'production') {
    logger.add(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, correlationId, userId, ...meta }) => {
            let logMessage = `${level}: ${message}`;
            if (correlationId) logMessage += ` [${correlationId}]`;
            if (userId) logMessage += ` [User:${userId}]`;
            
            if (Object.keys(meta).length > 0) {
              logMessage += ` ${JSON.stringify(meta, null, 2)}`;
            }
            
            return logMessage;
          })
        )
      })
    );
  }

  // Enhanced stream for Morgan HTTP logging
  logger.stream = {
    write: function (message, encoding) {
      // Parse Morgan log format and add metadata
      const logData = message.trim();
      logger.info('HTTP Request', { 
        type: 'http_access',
        raw: logData,
        timestamp: new Date().toISOString()
      });
    }
  };

  // Add security logging methods
  logger.security = {
    loginAttempt: (userId, success, metadata = {}) => {
      logger.warn('Login Attempt', {
        type: 'authentication',
        userId,
        success,
        ...metadata
      });
    },
    
    suspiciousActivity: (userId, activity, metadata = {}) => {
      logger.error('Suspicious Activity Detected', {
        type: 'security_threat',
        userId,
        activity,
        ...metadata
      });
    },
    
    dataAccess: (userId, resource, action, metadata = {}) => {
      logger.info('Data Access', {
        type: 'data_access',
        userId,
        resource,
        action,
        ...metadata
      });
    }
  };

  // Add performance logging methods
  logger.performance = {
    dbQuery: (query, duration, metadata = {}) => {
      logger.debug('Database Query', {
        type: 'performance',
        query,
        duration: `${duration}ms`,
        ...metadata
      });
    },
    
    apiResponse: (endpoint, method, duration, status, metadata = {}) => {
      logger.info('API Response', {
        type: 'performance',
        endpoint,
        method,
        duration: `${duration}ms`,
        status,
        ...metadata
      });
    }
  };
} else {
  logger = createFallbackLogger();
}

module.exports = logger;
