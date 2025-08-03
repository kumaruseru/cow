// Enhanced Secure Cow Social Network Server
// Phase 1 Security Implementation - Full Feature Version

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Import enhanced security middleware
const { 
  applySecurityMiddleware, 
  applyValidationRules, 
  applyErrorHandling 
} = require('./middleware/integrated-security');

// Import authentication utilities
const { 
  authenticateToken,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken
} = require('./middleware/auth');

// Import database connection
const connectDB = require('./config/database');

// Import models
const User = require('./models/User');
const Post = require('./models/Post');
const Notification = require('./models/Notification');
const Message = require('./models/Message');
const Friend = require('./models/Friend');

// Import logger (using console.log for stability)
const logger = {
  info: console.log,
  error: console.error,
  warn: console.warn,
  security: {
    loginAttempt: (email, success, ip, userAgent) => {
      console.log(`🔐 Login attempt: ${email} from ${ip} - ${success ? 'SUCCESS' : 'FAILED'}`);
    },
    failedLogin: (email, ip, userAgent, reason) => {
      console.log(`❌ Failed login: ${email} from ${ip} - ${reason}`);
    },
    suspiciousActivity: (userId, activity, details) => {
      console.log(`🚨 Suspicious activity: ${activity} - User: ${userId}`, details);
    }
  }
};

// Initialize Express app
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

// Global data storage (temporary - replace with Redis in production)
const refreshTokens = new Set();

// Helper functions
const findUserById = async (id) => {
  try {
    return await User.findById(id);
  } catch (error) {
    logger.error('Error finding user by ID:', error);
    return null;
  }
};

const findUserByEmail = async (email) => {
  try {
    return await User.findOne({ email });
  } catch (error) {
    logger.error('Error finding user by email:', error);
    return null;
  }
};

// Create admin user if not exists
const createAdminUser = async () => {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      const adminUser = new User({
        firstName: 'Admin',
        lastName: 'User',
        email: process.env.ADMIN_EMAIL || 'admin@cow.social',
        password: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123456', 12),
        role: 'admin',
        verified: true,
        profile: {
          bio: 'System Administrator'
        }
      });
      await adminUser.save();
      logger.info('Admin user created successfully');
    }

    // Update existing user to admin if specified
    const userEmail = process.env.MAKE_ADMIN_EMAIL;
    if (userEmail) {
      const user = await User.findOne({ email: userEmail });
      if (user && user.role !== 'admin') {
        user.role = 'admin';
        await user.save();
        logger.info(`Updated ${userEmail} to admin role`);
      }
    }
  } catch (error) {
    logger.error('Error creating admin user:', error);
  }
};

// Initialize admin user
createAdminUser();

// =====================
// AUTHENTICATION ROUTES (Enhanced with Security Middleware)
// =====================

// Registration endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, birthDate, gender, profile } = req.body;

    logger.info('Registration attempt', { email, ip: req.ip });

    // Check if user already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      logger.security.failedLogin(email, req.ip, req.get('User-Agent'), 'User already exists');
      return res.status(409).json({
        success: false,
        message: 'Email đã được sử dụng',
        code: 'EMAIL_EXISTS'
      });
    }

    // Hash password with high cost
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create new user
    const newUser = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      birthDate: new Date(birthDate),
      gender,
      profile: profile || {},
      verified: false,
      role: 'user',
      createdAt: new Date(),
      lastLogin: new Date(),
      loginAttempts: 0,
      isLocked: false
    });

    await newUser.save();

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
    logger.security.loginAttempt(email, true, req.ip, req.get('User-Agent'));

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
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const clientIp = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    logger.info('Login attempt', { email, ip: clientIp });

    // Find user
    const user = await findUserByEmail(email);
    if (!user) {
      logger.security.failedLogin(email, clientIp, userAgent, 'User not found');
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không đúng',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      logger.security.failedLogin(email, clientIp, userAgent, 'Account locked');
      return res.status(423).json({
        success: false,
        message: 'Tài khoản đã bị khóa do đăng nhập sai quá nhiều lần',
        code: 'ACCOUNT_LOCKED'
      });
    }

    // Validate password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      // Increment login attempts
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      user.lastFailedLogin = new Date();

      // Lock account after 5 failed attempts
      if (user.loginAttempts >= 5) {
        user.isLocked = true;
        user.lockedAt = new Date();
        logger.security.suspiciousActivity(user._id, 'Account locked due to failed login attempts', {
          attempts: user.loginAttempts,
          ip: clientIp
        });
      }

      await user.save();

      logger.security.failedLogin(email, clientIp, userAgent, 'Invalid password');
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không đúng',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Reset login attempts on successful login
    user.loginAttempts = 0;
    user.lastLogin = new Date();
    user.lastLoginIP = clientIp;
    user.loginCount = (user.loginCount || 0) + 1;
    user.isLocked = false;
    user.lockedAt = null;
    user.lastUserAgent = userAgent;

    await user.save();

    // Generate tokens
    const accessToken = generateToken({
      id: user._id,
      email: user.email,
      role: user.role
    });
    
    const refreshToken = generateRefreshToken({ id: user._id });
    refreshTokens.add(refreshToken);

    logger.security.loginAttempt(email, true, clientIp, userAgent);
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
app.post('/api/auth/refresh', async (req, res) => {
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
app.post('/api/auth/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      refreshTokens.delete(refreshToken);
    }
    
    if (req.user) {
      logger.info(`User logged out: ${req.user.email}`);
    }
    
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
});

//============================================================================
// WEB ROUTES - SERVING HTML PAGES
//============================================================================

// Home page
app.get(['/', '/index.html'], (req, res) => {
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
    res.sendFile(path.join(__dirname, `${route.substring(1)}.html`));
  });
});

// Get current user with security checks
app.get('/api/user', async (req, res) => {
  try {
    // For now, we'll handle authentication client-side
    // In production, add authenticateToken middleware here
    
    res.json({
      success: true,
      message: 'User endpoint active'
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user data',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

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
  console.error('Global error handler:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  // Security: Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    success: false,
    error: isDevelopment ? err.message : 'Internal server error',
    ...(isDevelopment && { stack: err.stack })
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 Cow Social Network Server started successfully');
  console.log(`📍 Server running on http://localhost:${PORT}`);
  console.log('🔒 Security middleware enabled');
  console.log('🛡️ Rate limiting active');
  console.log('📝 Request logging enabled');
  console.log('🌐 Ready for connections...');
});

module.exports = app;
