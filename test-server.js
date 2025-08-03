#!/usr/bin/env node

/**
 * Simple Server Test for Penetration Testing
 * Minimal server with basic authentication to test vulnerabilities
 */

const express = require('express');
const cors = require('cors');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3002;

// Simple in-memory storage (for testing only)
const users = [];
const sessions = new Map();

// Middleware
app.use(cors());
app.use(express.json());

// Simple secret keys (weak for testing)
const JWT_SECRET = 'simple_secret_123';
const ADMIN_PASSWORD = 'admin123';

// Create default admin user
const adminUser = {
  id: 1,
  firstName: 'Admin',
  lastName: 'User',
  email: 'admin@cow.com',
  password: bcryptjs.hashSync(ADMIN_PASSWORD, 10),
  role: 'admin',
  isLocked: false,
  loginAttempts: 0
};
users.push(adminUser);

// Helper functions
const findUserByEmail = (email) => {
  return users.find(u => u.email.toLowerCase() === email.toLowerCase());
};

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
};

// Simple auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false,
      error: 'Access token required' 
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ 
        success: false,
        error: 'Invalid token' 
      });
    }
    req.user = user;
    next();
  });
};

//============================================================================
// API ROUTES
//============================================================================

// Registration (vulnerable to various attacks)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    
    // Weak validation (intentionally vulnerable)
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password required'
      });
    }

    // Check if user exists
    const existingUser = findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'User already exists'
      });
    }

    // Create user (weak password hashing)
    const hashedPassword = bcryptjs.hashSync(password, 8); // Weak rounds
    
    const newUser = {
      id: users.length + 1,
      firstName: firstName || 'User',
      lastName: lastName || '',
      email: email,
      password: hashedPassword,
      role: 'user',
      isLocked: false,
      loginAttempts: 0
    };
    
    users.push(newUser);
    
    const token = generateToken(newUser);
    
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: {
        id: newUser.id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        role: newUser.role
      },
      accessToken: token
    });
    
  } catch (error) {
    // Vulnerable error handling (information disclosure)
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack // Leaks stack trace
    });
  }
});

// Login (vulnerable to brute force and SQL injection-like attacks)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Intentionally vulnerable to injection-like attacks
    const user = findUserByEmail(email);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // No account lockout protection
    const isValidPassword = bcryptjs.compareSync(password, user.password);
    
    if (!isValidPassword) {
      user.loginAttempts++;
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Reset attempts on success
    user.loginAttempts = 0;
    
    const token = generateToken(user);
    
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      },
      accessToken: token
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Get user (vulnerable to IDOR)
app.get('/api/user', authenticateToken, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  res.json({
    success: true,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role
    }
  });
});

// Get user by ID (vulnerable to IDOR)
app.get('/api/user/:id', authenticateToken, (req, res) => {
  const userId = parseInt(req.params.id);
  const user = users.find(u => u.id === userId);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  // No authorization check - any authenticated user can view any user
  res.json({
    success: true,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      loginAttempts: user.loginAttempts // Sensitive info exposure
    }
  });
});

// Admin endpoint (vulnerable to privilege escalation)
app.get('/api/admin/users', authenticateToken, (req, res) => {
  // Weak role check
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Access denied'
    });
  }

  res.json({
    success: true,
    users: users.map(u => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role,
      loginAttempts: u.loginAttempts
    }))
  });
});

// Update user (vulnerable to privilege escalation)
app.put('/api/user', authenticateToken, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  // Dangerous: allows updating any field including role
  Object.assign(user, req.body);
  
  res.json({
    success: true,
    message: 'User updated',
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role
    }
  });
});

// File upload endpoint (vulnerable)
app.post('/api/upload', authenticateToken, (req, res) => {
  // Simulated file upload without proper validation
  const { filename, content } = req.body;
  
  if (!filename || !content) {
    return res.status(400).json({
      success: false,
      error: 'Filename and content required'
    });
  }

  // No file type validation
  // No size limits
  // No malware scanning
  
  res.json({
    success: true,
    message: 'File uploaded successfully',
    filename: filename,
    size: content.length
  });
});

// Debug endpoint (information disclosure)
app.get('/debug', (req, res) => {
  res.json({
    success: true,
    info: {
      environment: process.env.NODE_ENV,
      users: users.length,
      sessions: sessions.size,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      version: process.version,
      platform: process.platform
    }
  });
});

// Password reset (vulnerable)
app.post('/api/auth/reset-password', (req, res) => {
  const { email, newPassword } = req.body;
  
  if (!email || !newPassword) {
    return res.status(400).json({
      success: false,
      error: 'Email and new password required'
    });
  }

  const user = findUserByEmail(email);
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  // No verification token check!
  user.password = bcryptjs.hashSync(newPassword, 8);
  
  res.json({
    success: true,
    message: 'Password reset successful'
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running!' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message,
    stack: err.stack // Information disclosure
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Test Server running on http://localhost:${PORT}`);
  console.log(`👤 Admin user: admin@cow.com / ${ADMIN_PASSWORD}`);
  console.log(`⚠️  This server contains intentional vulnerabilities for testing`);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Test Server running on http://localhost:${PORT}`);
  console.log(`👤 Admin user: admin@cow.com / ${ADMIN_PASSWORD}`);
  console.log(`⚠️  This server contains intentional vulnerabilities for testing`);
});

module.exports = app;

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
