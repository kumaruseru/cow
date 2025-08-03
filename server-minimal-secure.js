// Minimalist Secure Cow Social Network Server
// Direct security implementation without complex middleware

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const cors = require('cors');
const compression = require('compression');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

// Import database connection
const connectDB = require('./config/database');

// Import models
const User = require('./models/User');
const emailService = require('./services/emailService');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// =============================
// DIRECT SECURITY IMPLEMENTATION
// =============================

// Trust proxy for proper IP detection
app.set('trust proxy', 1);

// Compression for better performance
app.use(compression());

// Security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://unpkg.com", "https://cdn.tailwindcss.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',');
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID']
};
app.use(cors(corsOptions));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    success: false,
    error: 'Quá nhiều lần đăng nhập, vui lòng thử lại sau 15 phút',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Quá nhiều yêu cầu, vui lòng thử lại sau',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

// Apply rate limiting
app.use('/api/auth/', authLimiter);
app.use('/api/', generalLimiter);

// Body parsing middleware with size limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({
        success: false,
        error: 'Invalid JSON payload',
        code: 'INVALID_JSON'
      });
      return;
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb'
}));

// NoSQL injection protection
app.use(mongoSanitize());

// HTTP Parameter Pollution protection
app.use(hpp({
  whitelist: ['tags', 'categories'] // Allow these parameters to appear multiple times
}));

// Static file serving with security headers
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (path.extname(filePath) === '.html') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
              .replace(/javascript:/gi, '')
              .replace(/on\w+\s*=/gi, '');
  };

  const sanitizeObject = (obj) => {
    if (obj && typeof obj === 'object') {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = sanitizeString(obj[key]);
        } else if (typeof obj[key] === 'object') {
          sanitizeObject(obj[key]);
        }
      }
    }
  };

  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);
  
  next();
};

app.use(sanitizeInput);

// Global data storage
const refreshTokens = new Set();

// Helper functions
const findUserByEmail = async email => {
  try {
    return await User.findOne({ email });
  } catch (error) {
    console.error('Error finding user by email:', error);
    return null;
  }
};

const generateToken = payload => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'fallback-secret', { 
    expiresIn: process.env.JWT_EXPIRES_IN || '1h' 
  });
};

const generateRefreshToken = payload => {
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

    // Basic validation
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

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
      birthDate: birthDate ? new Date(birthDate) : null,
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

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

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
    const storedPassword = user.passwordHash || user.password;
    if (!storedPassword) {
      console.log(`❌ Login failed: No password hash found - ${email}`);
      return res.status(500).json({
        success: false,
        error: 'Account data corrupted. Please contact support.',
        code: 'MISSING_PASSWORD'
      });
    }

    const isValidPassword = await bcrypt.compare(password, storedPassword);
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

// FORGOT PASSWORD ENDPOINTS
// =============================
console.log('🔧 Registering forgot password endpoints...');

// Request password reset
app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const clientIp = req.ip || req.connection.remoteAddress;
    console.log(`🔑 Password reset request: ${email} from ${clientIp}`);

    // Find user
    const user = await findUserByEmail(email);
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({
        success: true,
        message: 'Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu'
      });
    }

    // Generate reset token
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Set token and expiry (15 minutes)
    user.passwordResetToken = resetTokenHash;
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    console.log(`✅ Password reset token generated for: ${email}`);

    // In production, send email here
    // For development, log the reset link
    const resetUrl = `http://localhost:3000/reset-password?token=${resetToken}`;
    console.log(`🔗 Password reset URL: ${resetUrl}`);

    res.json({
      success: true,
      message: 'Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu',
      // Remove this in production
      resetUrl: process.env.NODE_ENV === 'development' ? resetUrl : undefined
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during password reset request'
    });
  }
});

// Reset password with token
console.log('🔧 Registering reset password endpoint...');
app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        error: 'Token and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    const clientIp = req.ip || req.connection.remoteAddress;
    console.log(`🔄 Password reset attempt from ${clientIp}`);

    // Hash the token to match stored version
    const crypto = require('crypto');
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid token
    const user = await User.findOne({
      passwordResetToken: resetTokenHash,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      console.log(`❌ Invalid or expired reset token from ${clientIp}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update password and clear reset fields
    user.passwordHash = hashedPassword;
    user.password = hashedPassword; // For compatibility
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.isLocked = false; // Unlock account if it was locked
    user.loginAttempts = 0;
    user.lockedAt = null;
    await user.save();

    console.log(`✅ Password reset successful for: ${user.email}`);

    res.json({
      success: true,
      message: 'Mật khẩu đã được đặt lại thành công'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during password reset'
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

// =============================
// FORGOT PASSWORD ENDPOINTS
// =============================
console.log('🔧 Registering forgot password endpoints...');

// Request password reset
app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const clientIp = req.ip || req.connection.remoteAddress;
    console.log(`🔑 Password reset request: ${email} from ${clientIp}`);

    // Find user
    const user = await findUserByEmail(email);
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({
        success: true,
        message: 'Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu'
      });
    }

    // Generate reset token
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Set token and expiry (15 minutes)
    user.passwordResetToken = resetTokenHash;
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    console.log(`✅ Password reset token generated for: ${email}`);

    // In production, send email here
    // For development, log the reset link
    const resetUrl = `http://localhost:3000/reset-password?token=${resetToken}`;
    console.log(`🔗 Password reset URL: ${resetUrl}`);

    res.json({
      success: true,
      message: 'Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu',
      // Remove this in production
      resetUrl: process.env.NODE_ENV === 'development' ? resetUrl : undefined
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during password reset request'
    });
  }
});

// Reset password with token
console.log('🔧 Registering reset password endpoint...');
app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        error: 'Token and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    const clientIp = req.ip || req.connection.remoteAddress;
    console.log(`🔄 Password reset attempt from ${clientIp}`);

    // Hash the token to match stored version
    const crypto = require('crypto');
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid token
    const user = await User.findOne({
      passwordResetToken: resetTokenHash,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      console.log(`❌ Invalid or expired reset token from ${clientIp}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update password and clear reset fields
    user.passwordHash = hashedPassword;
    user.password = hashedPassword; // For compatibility
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.isLocked = false; // Unlock account if it was locked
    user.loginAttempts = 0;
    user.lockedAt = null;
    await user.save();

    console.log(`✅ Password reset successful for: ${user.email}`);

    res.json({
      success: true,
      message: 'Mật khẩu đã được đặt lại thành công'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during password reset'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 Cow Social Network Server (Minimal Secure)');
  console.log(`📍 Server running on http://localhost:${PORT}`);
  console.log('🔒 Security features:');
  console.log('  ✅ Helmet.js security headers');
  console.log('  ✅ Rate limiting (Auth: 10/15min, General: 100/15min)');
  console.log('  ✅ NoSQL injection protection');
  console.log('  ✅ XSS input sanitization');
  console.log('  ✅ HTTP Parameter Pollution protection');
  console.log('  ✅ Account lockout after 5 failed attempts');
  console.log('  ✅ Secure password hashing (bcrypt cost 12)');
  console.log('  ✅ JWT token authentication');
  console.log('  ✅ CORS protection');
  console.log('🌐 Login page: http://localhost:3000/login');
  console.log('✅ Ready for secure connections!');
});

module.exports = app;
