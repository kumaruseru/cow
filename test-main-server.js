const express = require('express');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Starting COW Social Network Server...');

// Basic Helmet configuration
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for now to test
  crossOriginEmbedderPolicy: false
}));

// Basic middleware
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'COW Social Network is running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Test security headers endpoint
app.get('/test-security', (req, res) => {
  res.json({
    success: true,
    message: 'Security headers test',
    headers: {
      'X-Content-Type-Options': res.get('X-Content-Type-Options'),
      'X-Frame-Options': res.get('X-Frame-Options'),
      'X-DNS-Prefetch-Control': res.get('X-DNS-Prefetch-Control'),
    }
  });
});

// Basic auth test endpoint (no database needed)
app.post('/test-auth', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username and password required'
    });
  }
  
  // Simple test auth (not real auth)
  if (username === 'test' && password === 'test123') {
    res.json({
      success: true,
      message: 'Authentication test passed',
      user: { username: 'test', id: 'test123' }
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
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
  console.log(`🚀 COW Social Network Test Server running on http://localhost:${PORT}`);
  console.log(`📋 Endpoints available:`);
  console.log(`   GET  /health - Health check`);
  console.log(`   GET  /test-security - Security headers test`);
  console.log(`   POST /test-auth - Authentication test`);
  console.log('✅ Server started successfully');
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
