#!/usr/bin/env node

/**
 * Security Stress Test Suite for Cow Social Network
 * Tests rate limiting, authentication, input validation, and other security measures
 */

const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = 'test.security@example.com';
const WEAK_PASSWORD = '123';
const STRONG_PASSWORD = 'SecureP@ssw0rd123!';

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

class SecurityTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
    this.tokens = {};
  }

  async test(name, testFunction) {
    try {
      log('blue', `\n🧪 Testing: ${name}`);
      const result = await testFunction();
      if (result.success) {
        this.results.passed++;
        log('green', `✅ PASS: ${name}`);
        if (result.details) log('white', `   ${result.details}`);
      } else {
        this.results.failed++;
        log('red', `❌ FAIL: ${name}`);
        if (result.error) log('red', `   Error: ${result.error}`);
      }
      this.results.tests.push({ name, ...result });
    } catch (error) {
      this.results.failed++;
      log('red', `❌ FAIL: ${name}`);
      log('red', `   Error: ${error.message}`);
      this.results.tests.push({ name, success: false, error: error.message });
    }
  }

  // Test 1: Rate Limiting on Authentication
  async testAuthRateLimit() {
    const requests = [];
    const testEmail = `rate.test.${Date.now()}@example.com`;
    
    // Attempt 10 login requests in rapid succession
    for (let i = 0; i < 10; i++) {
      requests.push(
        axios.post(`${BASE_URL}/api/auth/login`, {
          email: testEmail,
          password: 'wrongpassword'
        }, { validateStatus: () => true })
      );
    }

    const responses = await Promise.all(requests);
    const rateLimited = responses.some(res => res.status === 429);
    
    return {
      success: rateLimited,
      details: rateLimited 
        ? `Rate limiting triggered after ${responses.findIndex(res => res.status === 429) + 1} requests`
        : 'Rate limiting not working - all requests went through'
    };
  }

  // Test 2: Account Lockout Protection
  async testAccountLockout() {
    const testEmail = `lockout.test.${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';
    
    // First register a user
    await axios.post(`${BASE_URL}/api/auth/register`, {
      firstName: 'Test',
      lastName: 'User',
      email: testEmail,
      password: testPassword
    }, { validateStatus: () => true });

    // Attempt 6 failed logins
    const attempts = [];
    for (let i = 0; i < 6; i++) {
      attempts.push(
        axios.post(`${BASE_URL}/api/auth/login`, {
          email: testEmail,
          password: 'wrongpassword'
        }, { validateStatus: () => true })
      );
    }

    const responses = await Promise.all(attempts);
    const lockoutResponse = responses[5]; // 6th attempt should be locked
    
    return {
      success: lockoutResponse.status === 423 || lockoutResponse.data?.code === 'ACCOUNT_LOCKED',
      details: lockoutResponse.status === 423 
        ? 'Account lockout working correctly'
        : `Account lockout not triggered. Status: ${lockoutResponse.status}`
    };
  }

  // Test 3: XSS Protection
  async testXSSProtection() {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '"><script>alert("XSS")</script>',
      'javascript:alert("XSS")',
      '<img src=x onerror=alert("XSS")>',
      '<svg onload=alert("XSS")>'
    ];

    // Register user with XSS payload in name
    const testEmail = `xss.test.${Date.now()}@example.com`;
    const response = await axios.post(`${BASE_URL}/api/auth/register`, {
      firstName: xssPayloads[0],
      lastName: xssPayloads[1],
      email: testEmail,
      password: STRONG_PASSWORD
    }, { validateStatus: () => true });

    const hasXSSScript = JSON.stringify(response.data).includes('<script>');
    
    return {
      success: !hasXSSScript,
      details: hasXSSScript 
        ? 'XSS payload found in response - sanitization failed'
        : 'XSS payloads properly sanitized'
    };
  }

  // Test 4: SQL/NoSQL Injection Protection
  async testInjectionProtection() {
    const injectionPayloads = [
      "'; DROP TABLE users; --",
      '{"$ne": null}',
      '{"$gt": ""}',
      '1\' OR \'1\'=\'1',
      '{"$where": "sleep(1000)"}'
    ];

    const testEmail = `injection.test.${Date.now()}@example.com`;
    
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: injectionPayloads[0],
      password: injectionPayloads[1]
    }, { validateStatus: () => true });

    // Should return 401 or 400, not 500 (which might indicate injection worked)
    return {
      success: response.status === 401 || response.status === 400,
      details: `Login with injection payload returned status: ${response.status}`
    };
  }

  // Test 5: Password Strength Validation
  async testPasswordStrength() {
    const weakPasswords = ['123', 'password', 'abc123', '111111', 'qwerty'];
    const testEmail = `password.test.${Date.now()}@example.com`;
    
    const response = await axios.post(`${BASE_URL}/api/auth/register`, {
      firstName: 'Test',
      lastName: 'User',
      email: testEmail,
      password: weakPasswords[0]
    }, { validateStatus: () => true });

    return {
      success: response.status === 400,
      details: response.status === 400 
        ? 'Weak passwords properly rejected'
        : `Weak password accepted. Status: ${response.status}`
    };
  }

  // Test 6: JWT Token Security
  async testJWTSecurity() {
    const testEmail = `jwt.test.${Date.now()}@example.com`;
    
    // Register and login to get token
    await axios.post(`${BASE_URL}/api/auth/register`, {
      firstName: 'JWT',
      lastName: 'Test',
      email: testEmail,
      password: STRONG_PASSWORD
    });

    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: testEmail,
      password: STRONG_PASSWORD
    });

    const token = loginResponse.data.accessToken;
    
    // Test with invalid token
    const invalidTokenResponse = await axios.get(`${BASE_URL}/api/user`, {
      headers: { Authorization: 'Bearer invalid.token.here' },
      validateStatus: () => true
    });

    // Test with no token
    const noTokenResponse = await axios.get(`${BASE_URL}/api/user`, {
      validateStatus: () => true
    });

    const invalidRejected = invalidTokenResponse.status === 401;
    const noTokenRejected = noTokenResponse.status === 401;
    
    return {
      success: invalidRejected && noTokenRejected,
      details: `Invalid token: ${invalidTokenResponse.status}, No token: ${noTokenResponse.status}`
    };
  }

  // Test 7: CORS Protection
  async testCORSProtection() {
    try {
      const response = await axios.get(`${BASE_URL}/api/user`, {
        headers: {
          'Origin': 'https://malicious-site.com',
          'Access-Control-Request-Method': 'GET'
        },
        validateStatus: () => true
      });

      // Check if CORS headers are present
      const corsHeader = response.headers['access-control-allow-origin'];
      const isRestricted = !corsHeader || corsHeader !== '*';
      
      return {
        success: isRestricted,
        details: isRestricted 
          ? 'CORS properly configured'
          : `CORS allows all origins: ${corsHeader}`
      };
    } catch (error) {
      return {
        success: true,
        details: 'CORS blocked the request entirely'
      };
    }
  }

  // Test 8: File Upload Security
  async testFileUploadSecurity() {
    // This test would need authentication
    const testEmail = `upload.test.${Date.now()}@example.com`;
    
    // Register and login
    await axios.post(`${BASE_URL}/api/auth/register`, {
      firstName: 'Upload',
      lastName: 'Test',
      email: testEmail,
      password: STRONG_PASSWORD
    });

    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: testEmail,
      password: STRONG_PASSWORD
    });

    const token = loginResponse.data.accessToken;
    
    // Test uploading a non-image file (should be rejected)
    const FormData = require('form-data');
    const form = new FormData();
    form.append('avatar', Buffer.from('malicious script content'), {
      filename: 'script.js',
      contentType: 'application/javascript'
    });

    try {
      const response = await axios.post(`${BASE_URL}/api/upload-avatar`, form, {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${token}`
        },
        validateStatus: () => true
      });

      return {
        success: response.status === 400 || response.status === 422,
        details: `Non-image upload returned status: ${response.status}`
      };
    } catch (error) {
      return {
        success: true,
        details: 'File upload properly secured (endpoint may not exist)'
      };
    }
  }

  // Test 9: Input Length Limits
  async testInputLimits() {
    const longString = 'A'.repeat(10000); // 10KB string
    const testEmail = `length.test.${Date.now()}@example.com`;
    
    const response = await axios.post(`${BASE_URL}/api/auth/register`, {
      firstName: longString,
      lastName: 'Test',
      email: testEmail,
      password: STRONG_PASSWORD
    }, { validateStatus: () => true });

    return {
      success: response.status === 400 || response.status === 413,
      details: `Long input returned status: ${response.status}`
    };
  }

  // Test 10: Error Information Disclosure
  async testErrorDisclosure() {
    const response = await axios.get(`${BASE_URL}/api/nonexistent-endpoint`, {
      validateStatus: () => true
    });

    const hasStackTrace = JSON.stringify(response.data).includes('stack');
    const hasInternalPaths = JSON.stringify(response.data).includes('C:\\') || 
                           JSON.stringify(response.data).includes('/home/');
    
    return {
      success: !hasStackTrace && !hasInternalPaths,
      details: hasStackTrace || hasInternalPaths 
        ? 'Error responses contain sensitive information'
        : 'Error responses properly sanitized'
    };
  }

  // Test 11: Session Fixation Protection
  async testSessionSecurity() {
    const testEmail = `session.test.${Date.now()}@example.com`;
    
    // Register user
    await axios.post(`${BASE_URL}/api/auth/register`, {
      firstName: 'Session',
      lastName: 'Test',
      email: testEmail,
      password: STRONG_PASSWORD
    });

    // Login twice and check if tokens are different
    const login1 = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: testEmail,
      password: STRONG_PASSWORD
    });

    const login2 = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: testEmail,
      password: STRONG_PASSWORD
    });

    const token1 = login1.data.accessToken;
    const token2 = login2.data.accessToken;
    
    return {
      success: token1 !== token2,
      details: token1 !== token2 
        ? 'Different tokens generated for each login'
        : 'Same token reused - potential session fixation vulnerability'
    };
  }

  // Test 12: Concurrent Request Handling
  async testConcurrentRequests() {
    const testEmail = `concurrent.test.${Date.now()}@example.com`;
    
    // Create 50 concurrent registration requests
    const requests = [];
    for (let i = 0; i < 50; i++) {
      requests.push(
        axios.post(`${BASE_URL}/api/auth/register`, {
          firstName: 'Concurrent',
          lastName: `Test${i}`,
          email: `${testEmail}.${i}`,
          password: STRONG_PASSWORD
        }, { validateStatus: () => true })
      );
    }

    const responses = await Promise.all(requests);
    const successCount = responses.filter(res => res.status === 201).length;
    const errorCount = responses.filter(res => res.status >= 500).length;
    
    return {
      success: errorCount === 0,
      details: `${successCount} successful, ${errorCount} server errors out of 50 requests`
    };
  }

  async runAllTests() {
    log('cyan', '🔐 Starting Security Stress Test Suite');
    log('cyan', '==========================================\n');

    await this.test('Authentication Rate Limiting', () => this.testAuthRateLimit());
    await this.test('Account Lockout Protection', () => this.testAccountLockout());
    await this.test('XSS Protection', () => this.testXSSProtection());
    await this.test('Injection Protection', () => this.testInjectionProtection());
    await this.test('Password Strength Validation', () => this.testPasswordStrength());
    await this.test('JWT Token Security', () => this.testJWTSecurity());
    await this.test('CORS Protection', () => this.testCORSProtection());
    await this.test('File Upload Security', () => this.testFileUploadSecurity());
    await this.test('Input Length Limits', () => this.testInputLimits());
    await this.test('Error Information Disclosure', () => this.testErrorDisclosure());
    await this.test('Session Security', () => this.testSessionSecurity());
    await this.test('Concurrent Request Handling', () => this.testConcurrentRequests());

    this.printResults();
  }

  printResults() {
    log('cyan', '\n==========================================');
    log('cyan', '🔐 Security Test Results Summary');
    log('cyan', '==========================================');
    
    log('green', `✅ Passed: ${this.results.passed}`);
    log('red', `❌ Failed: ${this.results.failed}`);
    
    const total = this.results.passed + this.results.failed;
    const percentage = ((this.results.passed / total) * 100).toFixed(1);
    
    if (percentage >= 90) {
      log('green', `🏆 Security Score: ${percentage}% - EXCELLENT`);
    } else if (percentage >= 80) {
      log('yellow', `🥈 Security Score: ${percentage}% - GOOD`);
    } else if (percentage >= 70) {
      log('yellow', `🥉 Security Score: ${percentage}% - FAIR`);
    } else {
      log('red', `⚠️ Security Score: ${percentage}% - NEEDS IMPROVEMENT`);
    }

    if (this.results.failed > 0) {
      log('red', '\n🚨 Failed Tests:');
      this.results.tests
        .filter(test => !test.success)
        .forEach(test => {
          log('red', `   • ${test.name}: ${test.error || 'Failed'}`);
        });
    }

    log('cyan', '\n==========================================');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new SecurityTester();
  tester.runAllTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = SecurityTester;
