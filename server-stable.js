// Stable Secure Cow Social Network Server
// Optimized for stability while maintaining security

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

// Import enhanced security middleware
const { 
  applySecurityMiddleware, 
  applyValidationRules, 
  applyErrorHandling 
} = require('./middleware/integrated-security');

// Import database connection
const connectDB = require('./config/database');

// Import models
const User = require('./models/User');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Apply comprehensive security middleware
applySecurityMiddleware(app);

// Apply validation rules to routes
applyValidationRules(app);

// Global data storage (temporary)
const refreshTokens = new Set();

// Helper functions
const findUserByEmail = async (email) => {
  try {
    return await User.findOne({ email });
  } catch (error) {
    console.error('Error finding user by email:', error);
    return null;
  }
};

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'fallback-secret', { 
    expiresIn: process.env.JWT_EXPIRES_IN || '1h' 
  });
};

const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret', { 
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' 
  });
};

// =====================
// AUTHENTICATION ROUTES
// =====================

// Registration endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, birthDate, gender, profile } = req.body;

    console.log(`📝 Registration attempt: ${email} from ${req.ip}`);

    // Check if user already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      console.log(`❌ Registration failed: Email exists - ${email}`);
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

    console.log(`✅ User registered successfully: ${firstName} ${lastName} (${email})`);

    // Generate secure tokens
    const accessToken = generateToken({
      id: newUser._id,
      email: newUser.email,
      role: newUser.role
    });
    
    const refreshToken = generateRefreshToken({ id: newUser._id });
    refreshTokens.add(refreshToken);

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
    console.log(`🔐 Login attempt: ${email} from ${clientIp}`);

    // Find user
    const user = await findUserByEmail(email);
    if (!user) {
      console.log(`❌ Login failed: User not found - ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không đúng',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      console.log(`🔒 Login failed: Account locked - ${email}`);
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
        console.log(`🚨 Account locked: ${email} (${user.loginAttempts} attempts) from ${clientIp}`);
      }

      await user.save();

      console.log(`❌ Login failed: Invalid password - ${email}`);
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

    await user.save();

    // Generate tokens
    const accessToken = generateToken({
      id: user._id,
      email: user.email,
      role: user.role
    });
    
    const refreshToken = generateRefreshToken({ id: user._id });
    refreshTokens.add(refreshToken);

    console.log(`✅ Login successful: ${email} from ${clientIp}`);

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

// Refresh token endpoint
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

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret');
    const user = await User.findById(decoded.id);

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
  } catch (error) {
    refreshTokens.delete(req.body.refreshToken);
    console.error('Token refresh error:', error);
    return res.status(403).json({ 
      success: false,
      error: 'Invalid refresh token',
      code: 'TOKEN_VERIFICATION_FAILED'
    });
  }
});

// Logout endpoint
app.post('/api/auth/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      refreshTokens.delete(refreshToken);
    }
    
    console.log(`👋 User logged out from ${req.ip}`);
    
    res.json({ 
      success: true,
      message: 'Logged out successfully' 
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
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

// Protected routes
const protectedRoutes = ['/messages', '/profile', '/friends', '/notifications', '/settings'];
protectedRoutes.forEach(route => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, `${route.substring(1)}.html`));
  });
});

// User API endpoint
app.get('/api/user', async (req, res) => {
  res.json({
    success: true,
    message: 'User endpoint active'
  });
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

// Handle all other 404s for web pages
app.use('*', (req, res) => {
  // If it's a web page request, serve index.html (SPA fallback)
  if (!req.originalUrl.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    res.status(404).json({
      success: false,
      error: 'Route not found'
    });
  }
});

// Apply error handling middleware
applyErrorHandling(app);

// Start server
app.listen(PORT, () => {
  console.log('🚀 Cow Social Network Server (Secure & Stable)');
  console.log(`📍 Server running on http://localhost:${PORT}`);
  console.log('🔒 Security middleware: ACTIVE');
  console.log('🛡️ Rate limiting: ACTIVE');
  console.log('📝 Input validation: ACTIVE');
  console.log('🌐 Login page: http://localhost:3000/login');
  console.log('✅ Ready for connections!');
});

module.exports = app;
