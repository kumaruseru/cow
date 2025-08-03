const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

// Import custom modules
const config = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const { securityAudit } = require('./middleware/securityAudit');
const { authLimiter, passwordResetLimiter } = require('./middleware/rateLimiter');
const { validateOrigin, cspMiddleware } = require('./middleware/csrf');
const logger = require('./utils/logger');
const cacheService = require('./services/cacheService');
const securityMonitoringService = require('./services/securityMonitoringService');
const dbOptimizationService = require('./services/dbOptimizationService');
const advancedRateLimitService = require('./services/advancedRateLimitService');
const apiPerformanceMonitor = require('./services/apiPerformanceMonitor');
const deviceFingerprintingService = require('./services/deviceFingerprintingService');
const activityTrackingService = require('./services/activityTrackingService');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const postRoutes = require('./routes/posts');
const commentRoutes = require('./routes/comments');
const friendRoutes = require('./routes/friends');
const chatRoutes = require('./routes/chat');
const notificationRoutes = require('./routes/notifications');
const twoFactorRoutes = require('./routes/twoFactor');
const callRoutes = require('./routes/calls');
const deviceRoutes = require('./routes/devices');
const healthRoutes = require('./routes/health');
const activityRoutes = require('./routes/activity');
const messageStatusRoutes = require('./routes/messageStatus');

// Load environment variables
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Enforce required environment variables in production
if (process.env.NODE_ENV === 'production') {
  const requiredEnvVars = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'SESSION_SECRET',
    'SESSION_ENCRYPTION_SECRET',
    'MONGODB_URI',
    'REDIS_URL',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
    'CLOUDINARY_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
  ];

  const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

  if (missingVars.length > 0) {
    logger.error('❌ Missing required environment variables:', missingVars);
    logger.error('💡 Set these environment variables before starting the application.');
    process.exit(1);
  }

  logger.info('✅ All required environment variables are set.');
}

// Initialize services
async function initializeServices() {
  try {
    // Initialize cache service
    await cacheService.connect();
    
    // Initialize security monitoring
    await securityMonitoringService.initialize();
    
    // Initialize database optimization
    await dbOptimizationService.initialize();
    
    // Initialize advanced rate limiting
    await advancedRateLimitService.initialize();
    
    // Initialize API performance monitoring
    apiPerformanceMonitor.initialize();
    
    // Initialize device fingerprinting
    await deviceFingerprintingService.initialize();
    
        // Initialize activity tracking service
    await activityTrackingService.initialize();

    // Initialize message status service  
    const messageStatusService = require('./services/messageStatusService');
    await messageStatusService.initialize();
    
    logger.info('✅ All services initialized successfully');
  } catch (error) {
    logger.error('❌ Service initialization failed:', error);
    // Continue without services for development
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}

// Socket.IO configuration
const io = socketIo(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make io accessible to routes
app.set('io', io);

// Trust proxy for production
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// API Performance Monitoring Middleware
app.use('/api/', apiPerformanceMonitor.middleware());

// Device Fingerprinting Middleware
app.use('/api/', async (req, res, next) => {
  try {
    if (req.user) {
      // Generate and analyze device fingerprint for authenticated users
      const fingerprint = deviceFingerprintingService.generateFingerprint(req);
      const analysis = deviceFingerprintingService.analyzeDevice(req, fingerprint);
      
      // Store device information
      await deviceFingerprintingService.storeFingerprint(req.user.id, analysis);
      
      // Add device info to request for further use
      req.deviceFingerprint = fingerprint.fingerprint;
      req.deviceAnalysis = analysis;
    }
  } catch (error) {
    logger.error('Device fingerprinting failed:', error);
  }
  next();
});

// Security Monitoring Middleware
app.use(async (req, res, next) => {
  const startTime = Date.now();
  
  // Check if IP is blocked
  const ip = req.ip || req.connection.remoteAddress;
  const isBlocked = await securityMonitoringService.isIPBlocked(ip);
  
  if (isBlocked) {
    logger.warn('Blocked IP attempted access', { ip, endpoint: req.originalUrl });
    return res.status(403).json({ 
      success: false, 
      error: 'Access denied due to security policy' 
    });
  }

  // Monitor the request
  res.on('finish', async () => {
    const responseTime = Date.now() - startTime;
    await securityMonitoringService.monitorRequest(req, res, responseTime);
  });

  next();
});

// Security Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// Enhanced Rate limiting with advanced service
app.use('/api/', advancedRateLimitService.getLimiter('api'));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'];
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Session configuration with enhanced security
app.use(session({
  name: 'cow.session',
  secret: process.env.SESSION_SECRET || 'your-super-secret-session-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    touchAfter: 24 * 3600, // lazy session update
    ttl: 7 * 24 * 60 * 60, // 7 days session expiry
    crypto: {
      secret: process.env.SESSION_ENCRYPTION_SECRET || 'session-encryption-secret'
    }
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Prevent XSS
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'strict' // CSRF protection
  },
  genid: () => {
    // Generate cryptographically strong session IDs
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(
  hpp({
    whitelist: ['sort', 'fields', 'page', 'limit']
  })
);

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { stream: logger.stream }));
}

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '..')));

// Routes for serving HTML files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

app.get('/messages', (req, res) => {
  res.sendFile(path.join(__dirname, '../messages.html'));
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, '../profile.html'));
});

app.get('/friends', (req, res) => {
  res.sendFile(path.join(__dirname, '../friends.html'));
});

app.get('/notifications', (req, res) => {
  res.sendFile(path.join(__dirname, '../notifications.html'));
});

app.get('/incoming-call', (req, res) => {
  res.sendFile(path.join(__dirname, '../incoming-call.html'));
});

app.get('/outgoing-call', (req, res) => {
  res.sendFile(path.join(__dirname, '../outgoing-call.html'));
});

app.get('/active-call', (req, res) => {
  res.sendFile(path.join(__dirname, '../active-call.html'));
});

// Security audit middleware
app.use(securityAudit);

// Origin validation and CSP
app.use(validateOrigin);
app.use(cspMiddleware);

// Database connection
config.connectDB();

// Socket.IO connection handling
require('./services/socketService')(io);

// Routes with enhanced rate limiting
app.use('/api/auth', advancedRateLimitService.getLimiter('auth'), authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/2fa', twoFactorRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/devices', deviceRoutes);

// Health and monitoring routes (no rate limiting for health checks)
app.use('/health', healthRoutes);

// Activity tracking routes
app.use('/api/activity', activityRoutes);

// Message status tracking routes
app.use('/api/message-status', messageStatusRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Cow Social Network API is running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 404 handler
app.all('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.originalUrl} not found`
  });
});

// Global error handler
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(async () => {
    logger.info('HTTP server closed');
    
    // Disconnect services
    await cacheService.disconnect();
    await mongoose.connection.close();
    
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  server.close(async () => {
    logger.info('HTTP server closed');
    
    // Disconnect services
    await cacheService.disconnect();
    await mongoose.connection.close();
    
    logger.info('Process terminated');
    process.exit(0);
  });
});

const PORT = process.env.PORT || 3000;

// Start server with service initialization
async function startServer() {
  try {
    // Initialize all services first
    await initializeServices();
    
    // Start the HTTP server
    server.listen(PORT, () => {
      logger.info(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
      logger.info(`📊 Cache service: ${cacheService.isConnected ? 'Connected' : 'Offline'}`);
      logger.info(`🛡️  Security monitoring: Active`);
      logger.info(`⚡ Database optimization: Active`);
      logger.info(`🚦 Advanced rate limiting: Active`);
      logger.info(`📈 API performance monitoring: Active`);
      logger.info(`🔍 Device fingerprinting: Active`);
      logger.info(`👀 Activity tracking: Active`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
startServer();

module.exports = app;
