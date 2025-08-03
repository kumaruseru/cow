const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Import database connection
const connectDB = require('./config/database');

// Import enhanced security middleware
const { 
  applySecurityMiddleware, 
  applyValidationRules, 
  applyErrorHandling 
} = require('./middleware/integrated-security');

const {
  authenticateToken,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken
} = require('./middleware/auth');

// Import logger
const logger = require('./utils/logger');

// Import models
const User = require('./models/User');
const Post = require('./models/Post');
const Notification = require('./models/Notification');
const Message = require('./models/Message');
const Friend = require('./models/Friend');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Apply comprehensive security middleware
applySecurityMiddleware(app);

// Apply validation rules to routes
applyValidationRules(app);

// Apply error handling middleware
applyErrorHandling(app);

// Static file serving handled by security middleware
// File uploads handled by validation middleware

// Global data storage (temporary - replace with Redis in production)
const refreshTokens = new Set();

// Utility functions with error handling
const findUserById = async (id) => {
  try {
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return null; // Invalid ObjectId
    }
    return await User.findById(id);
  } catch (error) {
    logger.error('Error finding user by ID:', error);
    return null;
  }
};

const findUserByEmail = async (email) => {
  try {
    if (!email || typeof email !== 'string') {
      return null;
    }
    // Normalize email to lowercase before searching
    const normalizedEmail = email.toLowerCase().trim();
    return await User.findByEmail(normalizedEmail);
  } catch (error) {
    logger.error('Error finding user by email:', error);
    return null;
  }
};

// Create admin user securely (only in development)
if (process.env.NODE_ENV === 'development') {
  const createAdminUser = async () => {
    try {
      const adminEmail = 'admin@cow.com';
      const existingAdmin = await User.findByEmail(adminEmail);
      
      if (!existingAdmin) {
        await User.create({
          firstName: 'Admin',
          lastName: 'User',
          username: 'Admin',
          email: adminEmail,
          password: process.env.ADMIN_PASSWORD || 'admin123', // Use env variable
          role: 'admin',
          verified: true,
          birthDate: new Date('1990-01-01'),
          gender: 'other'
        });
        logger.info('Admin user created successfully');
      }
      
      // Update specific user to admin role
      const userEmail = 'nghiaht281003@gmail.com';
      const userToUpdate = await User.findOneAndUpdate(
        { email: userEmail },
        { role: 'admin' },
        { new: true }
      );
      
      if (userToUpdate) {
        logger.info(`Updated ${userEmail} to admin role`);
      }
    } catch (error) {
      logger.error('Error creating admin user:', error);
    }
  };
  createAdminUser();
}

//============================================================================
// SECURE API ROUTES - AUTHENTICATION
//============================================================================

// Registration endpoint with comprehensive security
app.post(
  '/api/auth/register',
  async (req, res) => {
    try {
      // Normalize email to lowercase
      const { firstName, lastName, password, birthDate, gender, profile } = req.body;
      const email = req.body.email ? req.body.email.toLowerCase().trim() : '';

      logger.info('Registration attempt', { email, ip: req.ip });

    // Check if user already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      // logger.security.failedLogin(email, req.ip, req.get('User-Agent'), 'User already exists');
      return res.status(409).json({
        success: false,
        message: 'Email đã được sử dụng',
        code: 'EMAIL_EXISTS'
      });
    }

    // Create new user with secure defaults
    const newUser = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      password, // Will be hashed automatically by User model
      birthDate: birthDate ? new Date(birthDate) : undefined,
      gender,
      profile: profile || {},
      role: 'user',
      verified: false,
      // Security defaults
      accountStatus: 'active',
      loginAttempts: 0,
      isLocked: false
    });

    logger.info(`User registered successfully: ${firstName} ${lastName} (${email})`);

    // Generate secure tokens
    const accessToken = generateToken({
      id: newUser._id,
      email: newUser.email,
      role: newUser.role
    });
    
    const refreshToken = generateRefreshToken({ id: newUser._id });
    refreshTokens.add(refreshToken);

    // Log successful registration
    // logger.security.loginAttempt(email, true, req.ip, req.get('User-Agent'));
    console.log(`✅ Registration successful: ${email} from ${req.ip}`);

    res.status(201).json({
      success: true,
      message: 'Đăng ký thành công',
      user: {
        id: newUser._id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        role: newUser.role,
        avatar: newUser.profile?.avatar,
        verified: newUser.verified
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Login endpoint with security measures
app.post(
  '/api/auth/login',
  async (req, res) => {
    try {
      // Normalize email to lowercase
      const { password } = req.body;
      const email = req.body.email ? req.body.email.toLowerCase().trim() : '';
      const clientIp = req.ip;
      const userAgent = req.get('User-Agent');

    logger.info('Login attempt', { email, ip: clientIp });

    // Find user and check account status
    const user = await findUserByEmail(email);
    if (!user) {
      // logger.security.failedLogin(email, clientIp, userAgent, 'User not found');
      console.log(`❌ Login failed: User not found - ${email} from ${clientIp}`);
      return res.status(401).json({ 
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      // logger.security.failedLogin(email, clientIp, userAgent, 'Account locked');
      console.log(`🔒 Login failed: Account locked - ${email} from ${clientIp}`);
      return res.status(423).json({
        success: false,
        error: 'Account is temporarily locked due to multiple failed login attempts',
        code: 'ACCOUNT_LOCKED'
      });
    }

    // Verify password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      // Increment failed login attempts
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      user.lastFailedLogin = new Date();

      // Lock account after 5 failed attempts
      if (user.loginAttempts >= 5) {
        user.isLocked = true;
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        // logger.security.suspiciousActivity(user._id, 'Account locked due to failed login attempts', {
        //   attempts: user.loginAttempts,
        //   ip: clientIp
        // });
        console.log(`🚨 Suspicious activity: Account locked - ${user.email} (${user.loginAttempts} attempts) from ${clientIp}`);
      }

      await user.save();
      
      // logger.security.failedLogin(email, clientIp, userAgent, 'Invalid password');
      console.log(`❌ Login failed: Invalid password - ${email} from ${clientIp}`);
      return res.status(401).json({ 
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Reset failed login attempts on successful login
    user.loginAttempts = 0;
    user.isLocked = false;
    user.lockUntil = undefined;
    user.lastLogin = new Date();
    user.loginCount = (user.loginCount || 0) + 1;

    // Update security info
    user.lastLoginIP = clientIp;
    user.lastUserAgent = userAgent;
    
    await user.save();

    // Generate secure tokens
    const accessToken = generateToken({
      id: user._id,
      email: user.email,
      role: user.role
    });
    
    const refreshToken = generateRefreshToken({ id: user._id });
    refreshTokens.add(refreshToken);

    // Log successful login
    // logger.security.loginAttempt(email, true, clientIp, userAgent);
    console.log(`✅ Login successful: ${email} from ${clientIp}`);
    logger.info(`User logged in successfully: ${user.email}`);

    res.json({
      success: true,
      message: 'Đăng nhập thành công',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        avatar: user.profile?.avatar,
        verified: user.verified
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Refresh token endpoint with security validation
app.post(
  '/api/auth/refresh',
  async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshTokens.has(refreshToken)) {
        return res.status(403).json({ 
          success: false,
          error: 'Invalid refresh token',
          code: 'INVALID_REFRESH_TOKEN'
        });
      }

      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      const user = await findUserById(decoded.id);

      if (!user || user.isLocked) {
        refreshTokens.delete(refreshToken);
        return res.status(403).json({ 
          success: false,
          error: 'User not found or account locked',
          code: 'USER_NOT_FOUND'
        });
      }

      // Generate new access token
      const accessToken = generateToken({
        id: user._id,
        email: user.email,
        role: user.role
      });

      res.json({ 
        success: true,
        accessToken 
      });
    } catch (refreshError) {
      refreshTokens.delete(refreshToken);
      console.error('Token refresh error:', refreshError);
      return res.status(403).json({ 
        success: false,
        error: 'Invalid refresh token',
        code: 'TOKEN_VERIFICATION_FAILED'
      });
    }
});

// Secure logout endpoint
app.post(
  '/api/auth/logout',
  async (req, res) => {
    try {
      const { refreshToken } = req.body;
    
    if (refreshToken) {
      refreshTokens.delete(refreshToken);
    }
    
    logger.info(`User logged out: ${req.user.email}`);
      
      res.json({ 
        success: true,
        message: 'Logged out successfully' 
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Logout failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

//============================================================================
// PROTECTED HTML ROUTES WITH SECURITY CHECKS
//============================================================================

// Home page route
app.get(['/', '/index.html'], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Authentication pages (public)
app.get('/login', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/register', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'register.html'));
});

// Protected routes (authentication handled client-side for now)
const protectedRoutes = ['/messages', '/profile', '/friends', '/notifications', '/settings'];

protectedRoutes.forEach(route => {
  app.get(route, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(__dirname, `${route.substring(1)}.html`));
  });
});

//============================================================================
// PROTECTED API ROUTES WITH AUTHENTICATION
//============================================================================

// Get current user with security checks
app.get(
  '/api/user',
  async (req, res) => {
    try {
      const user = await findUserById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    if (user.isLocked) {
      return res.status(423).json({
        success: false,
        error: 'Account is locked',
        code: 'ACCOUNT_LOCKED'
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        avatar: user.profile?.avatar,
        verified: user.verified
      }
    });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user data',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

//============================================================================
// ERROR HANDLING & 404 ROUTES
//============================================================================

// Handle 404 for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    code: 'ENDPOINT_NOT_FOUND'
  });
});

// Handle all other 404s
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Global error handler:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    success: false,
    error: isDevelopment ? err.message : 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
    ...(isDevelopment && { stack: err.stack })
  });
});

//============================================================================
// SERVER STARTUP WITH SECURITY LOGGING
//============================================================================

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Start server with enhanced security logging
const server = app.listen(PORT, () => {
  logger.info(`🚀 Cow Social Network Server started successfully`);
  logger.info(`📡 Server running on http://localhost:${PORT}`);
  logger.info(`🔒 Security middleware enabled`);
  logger.info(`🛡️ Rate limiting active`);
  logger.info(`📝 Request logging enabled`);
  logger.info(`🗄️ Database connection: ${process.env.MONGODB_URI ? 'External' : 'Local'}`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Security startup checks
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      logger.error('⚠️ SECURITY WARNING: JWT_SECRET is too short or missing');
    }
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
      logger.error('⚠️ SECURITY WARNING: SESSION_SECRET is too short or missing');
    }
  }
});

module.exports = app;
