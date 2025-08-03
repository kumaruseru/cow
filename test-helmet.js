#!/usr/bin/env node

/**
 * Helmet Integration Test
 * Tests Helmet.js security headers without full server
 */

const express = require('express');
const { securityHeaders } = require('./middleware/security');

const app = express();
const port = 3333;

console.log('🔒 Testing Helmet.js Integration...\n');

// Apply Helmet security headers
app.use(securityHeaders);

// Simple test endpoint
app.get('/test-helmet', (req, res) => {
  res.json({
    success: true,
    message: 'Helmet.js is working!',
    headers: {
      'X-Content-Type-Options': res.get('X-Content-Type-Options'),
      'X-Frame-Options': res.get('X-Frame-Options'),
      'X-DNS-Prefetch-Control': res.get('X-DNS-Prefetch-Control'),
      'Strict-Transport-Security': res.get('Strict-Transport-Security'),
      'Content-Security-Policy': res.get('Content-Security-Policy')
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Start test server
app.listen(port, () => {
  console.log(`🚀 Helmet test server running on http://localhost:${port}`);
  console.log(`📋 Test endpoint: http://localhost:${port}/test-helmet\n`);
  
  // Auto-test after 1 second
  setTimeout(async () => {
    try {
      const response = await fetch(`http://localhost:${port}/test-helmet`);
      const data = await response.json();
      
      console.log('✅ Helmet Integration Test Results:');
      console.log('==========================================');
      
      // Check each security header
      const headers = response.headers;
      const checks = [
        { name: 'X-Content-Type-Options', expected: 'nosniff' },
        { name: 'X-Frame-Options', expected: 'DENY' },
        { name: 'X-DNS-Prefetch-Control', expected: 'off' },
        { name: 'Strict-Transport-Security', contains: 'max-age' },
        { name: 'Content-Security-Policy', contains: "default-src 'self'" }
      ];
      
      let passedChecks = 0;
      
      checks.forEach(check => {
        const value = headers.get(check.name);
        let passed = false;
        
        if (check.expected && value === check.expected) {
          passed = true;
        } else if (check.contains && value && value.includes(check.contains)) {
          passed = true;
        }
        
        if (passed) {
          console.log(`✅ ${check.name}: ${value}`);
          passedChecks++;
        } else {
          console.log(`❌ ${check.name}: ${value || 'Not found'}`);
        }
      });
      
      console.log('==========================================');
      console.log(`🎯 Security Headers Score: ${passedChecks}/${checks.length} (${Math.round(passedChecks/checks.length*100)}%)`);
      
      if (passedChecks === checks.length) {
        console.log('🎉 HELMET.JS INTEGRATION SUCCESS!');
      } else {
        console.log('⚠️ Some headers missing or incorrect');
      }
      
      console.log('\n🔒 Helmet.js integration test completed.');
      process.exit(0);
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      process.exit(1);
    }
  }, 1000);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Helmet test server shutting down...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
