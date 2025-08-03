const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Enhanced database connection with security
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cow_social';
    
    // Production security options
    const connectionOptions = {
      // Connection management
      maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 10,
      minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE) || 5,
      maxIdleTimeMS: parseInt(process.env.DB_MAX_IDLE_TIME) || 30000,
      serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_TIMEOUT) || 5000,
      socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT) || 45000,
      family: 4,
      
      // Security options
      authSource: process.env.DB_AUTH_SOURCE || 'admin',
      ssl: process.env.NODE_ENV === 'production',
      sslValidate: process.env.NODE_ENV === 'production',
      
      // Read/Write concerns for data integrity
      readConcern: { level: 'majority' },
      writeConcern: { w: 'majority', j: true },
      
      // Additional security
      retryWrites: true,
      retryReads: true
    };

    // Add SSL certificate paths for production
    if (process.env.NODE_ENV === 'production') {
      if (process.env.DB_SSL_CERT) {
        connectionOptions.sslCert = process.env.DB_SSL_CERT;
      }
      if (process.env.DB_SSL_KEY) {
        connectionOptions.sslKey = process.env.DB_SSL_KEY;
      }
      if (process.env.DB_SSL_CA) {
        connectionOptions.sslCA = process.env.DB_SSL_CA;
      }
    }

    await mongoose.connect(mongoURI, connectionOptions);

    logger.info(`✅ MongoDB Connected: ${mongoose.connection.host}`);
    logger.info(`🔒 SSL Enabled: ${connectionOptions.ssl || false}`);
    
    // Security event listeners
    mongoose.connection.on('error', (err) => {
      logger.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('🔄 MongoDB reconnected');
    });

    // Performance monitoring
    mongoose.connection.on('slow', (details) => {
      logger.warn('🐌 Slow MongoDB operation:', details);
    });

    // Graceful shutdown with cleanup
    const gracefulShutdown = async (signal) => {
      logger.info(`📦 Received ${signal}, closing MongoDB connection...`);
      
      try {
        await mongoose.connection.close(false);
        logger.info('📦 MongoDB connection closed successfully');
        process.exit(0);
      } catch (err) {
        logger.error('❌ Error during MongoDB shutdown:', err);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon

  } catch (error) {
    logger.error('❌ MongoDB connection failed:', error.message);
    
    // Security: Don't expose connection details in error
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.error('Development error details:', error);
      process.exit(1);
    }
  }
};

// Database health check
const checkDatabaseHealth = async () => {
  try {
    const result = await mongoose.connection.db.admin().ping();
    return { healthy: true, latency: Date.now() };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return { healthy: false, error: error.message };
  }
};

// Query performance monitoring
const monitorQuery = (query, threshold = 100) => {
  const start = Date.now();
  
  return {
    end: () => {
      const duration = Date.now() - start;
      if (duration > threshold) {
        logger.warn('Slow query detected:', {
          query: query.toString(),
          duration: `${duration}ms`,
          threshold: `${threshold}ms`
        });
      }
      return duration;
    }
  };
};

module.exports = {
  connectDB,
  checkDatabaseHealth,
  monitorQuery
};