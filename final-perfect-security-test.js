#!/usr/bin/env node

/**
 * Final Perfect Security Test - Custom Implementation
 * This test will verify each security feature individually without conflicts
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const STRONG_PASSWORD = 'SecureP@ssw0rd123!';

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testAuthRateLimit() {
  console.log('\n🧪 Testing: Authentication Rate Limiting');
  const testEmail = `rate.test.${Date.now()}@example.com`;
  
  let rateLimitTriggered = false;
  for (let i = 1; i <= 15; i++) {
    try {
      const response = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: testEmail,
        password: 'wrongpassword'
      }, { validateStatus: () => true });
      
      if (response.status === 429) {
        console.log(`✅ PASS: Rate limiting triggered at request ${i}`);
        rateLimitTriggered = true;
        break;
      }
      
      await wait(100); // Small delay
    } catch (error) {
      console.log(`Request ${i} error: ${error.message}`);
    }
  }
  
  if (!rateLimitTriggered) {
    console.log('❌ FAIL: Rate limiting not working');
  }
  
  return rateLimitTriggered;
}

async function testAccountLockout() {
  console.log('\n🧪 Testing: Account Lockout Protection');
  const testEmail = `lockout.test.${Date.now()}@example.com`;
  
  // Register user
  await axios.post(`${BASE_URL}/api/auth/register`, {
    firstName: 'Test',
    lastName: 'User',
    email: testEmail,
    password: STRONG_PASSWORD
  }, { validateStatus: () => true });
  
  await wait(1000); // Wait for registration
  
  let lockoutTriggered = false;
  for (let i = 1; i <= 8; i++) {
    try {
      const response = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: testEmail,
        password: 'wrongpassword'
      }, { validateStatus: () => true });
      
      if (response.status === 423) {
        console.log(`✅ PASS: Account lockout triggered at attempt ${i}`);
        lockoutTriggered = true;
        break;
      }
      
      await wait(200);
    } catch (error) {
      console.log(`Attempt ${i} error: ${error.message}`);
    }
  }
  
  if (!lockoutTriggered) {
    console.log('❌ FAIL: Account lockout not working');
  }
  
  return lockoutTriggered;
}

async function testXSSProtection() {
  console.log('\n🧪 Testing: XSS Protection');
  const testEmail = `xss.test.${Date.now()}@example.com`;
  
  const response = await axios.post(`${BASE_URL}/api/auth/register`, {
    firstName: '<script>alert("XSS")</script>',
    lastName: '<img src=x onerror=alert("XSS")>',
    email: testEmail,
    password: STRONG_PASSWORD
  }, { validateStatus: () => true });
  
  const hasXSSScript = JSON.stringify(response.data).includes('<script>');
  
  if (!hasXSSScript) {
    console.log('✅ PASS: XSS payloads properly sanitized');
    return true;
  } else {
    console.log('❌ FAIL: XSS protection not working');
    return false;
  }
}

async function testInjectionProtection() {
  console.log('\n🧪 Testing: Injection Protection');
  
  const response = await axios.post(`${BASE_URL}/api/auth/login`, {
    email: "admin@test.com' OR '1'='1",
    password: 'password'
  }, { validateStatus: () => true });
  
  if (response.status === 400) {
    console.log('✅ PASS: SQL injection properly blocked');
    return true;
  } else {
    console.log(`❌ FAIL: Injection protection not working - Status: ${response.status}`);
    return false;
  }
}

async function testPasswordStrength() {
  console.log('\n🧪 Testing: Password Strength Validation');
  const testEmail = `password.test.${Date.now()}@example.com`;
  
  const response = await axios.post(`${BASE_URL}/api/auth/register`, {
    firstName: 'Test',
    lastName: 'User',
    email: testEmail,
    password: '123' // Weak password
  }, { validateStatus: () => true });
  
  if (response.status === 400) {
    console.log('✅ PASS: Weak passwords properly rejected');
    return true;
  } else {
    console.log(`❌ FAIL: Password strength validation not working - Status: ${response.status}`);
    return false;
  }
}

async function testJWTSecurity() {
  console.log('\n🧪 Testing: JWT Token Security');
  const testEmail = `jwt.test.${Date.now()}@example.com`;
  
  // Register and login
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
  const invalidResponse = await axios.get(`${BASE_URL}/api/user`, {
    headers: { Authorization: 'Bearer invalid.token.here' },
    validateStatus: () => true
  });
  
  // Test with no token
  const noTokenResponse = await axios.get(`${BASE_URL}/api/user`, {
    validateStatus: () => true
  });
  
  if (invalidResponse.status === 401 && noTokenResponse.status === 401) {
    console.log('✅ PASS: JWT security working correctly');
    return true;
  } else {
    console.log(`❌ FAIL: JWT security not working - Invalid: ${invalidResponse.status}, No token: ${noTokenResponse.status}`);
    return false;
  }
}

async function testCORSProtection() {
  console.log('\n🧪 Testing: CORS Protection');
  
  const response = await axios.get(`${BASE_URL}/api/cors-test`, {
    headers: { Origin: 'http://evil.com' },
    validateStatus: () => true
  });
  
  const corsHeader = response.headers['access-control-allow-origin'];
  
  if (!corsHeader || corsHeader !== 'http://evil.com') {
    console.log('✅ PASS: CORS properly configured');
    return true;
  } else {
    console.log('❌ FAIL: CORS allowing unauthorized origins');
    return false;
  }
}

async function testFileUploadSecurity() {
  console.log('\n🧪 Testing: File Upload Security');
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
  
  // Try uploading malicious file
  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', Buffer.from('<?php echo "hack"; ?>'), {
    filename: 'malicious.php',
    contentType: 'application/x-php'
  });
  
  const uploadResponse = await axios.post(`${BASE_URL}/api/upload`, form, {
    headers: {
      ...form.getHeaders(),
      'Authorization': `Bearer ${token}`
    },
    validateStatus: () => true
  });
  
  if (uploadResponse.status === 400 && uploadResponse.data?.error?.includes('file type')) {
    console.log('✅ PASS: File upload security working');
    return true;
  } else {
    console.log(`❌ FAIL: File upload security not working - Status: ${uploadResponse.status}`);
    return false;
  }
}

async function testInputLimits() {
  console.log('\n🧪 Testing: Input Length Limits');
  const longString = 'A'.repeat(10000);
  const testEmail = `length.test.${Date.now()}@example.com`;
  
  const response = await axios.post(`${BASE_URL}/api/auth/register`, {
    firstName: longString,
    lastName: 'Test',
    email: testEmail,
    password: STRONG_PASSWORD
  }, { validateStatus: () => true });
  
  if (response.status === 400) {
    console.log('✅ PASS: Input length limits working');
    return true;
  } else {
    console.log(`❌ FAIL: Input length limits not working - Status: ${response.status}`);
    return false;
  }
}

async function testErrorDisclosure() {
  console.log('\n🧪 Testing: Error Information Disclosure');
  
  const response = await axios.get(`${BASE_URL}/api/nonexistent-endpoint`, {
    validateStatus: () => true
  });
  
  const responseText = JSON.stringify(response.data);
  const hasStackTrace = responseText.includes('stack') || responseText.includes('Error:') || responseText.includes('at ');
  
  if (!hasStackTrace) {
    console.log('✅ PASS: Error responses properly sanitized');
    return true;
  } else {
    console.log('❌ FAIL: Error information disclosure detected');
    return false;
  }
}

async function testSessionSecurity() {
  console.log('\n🧪 Testing: Session Security');
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
  
  if (token1 !== token2) {
    console.log('✅ PASS: Different tokens generated for each login');
    return true;
  } else {
    console.log('❌ FAIL: Same token reused - potential session fixation vulnerability');
    return false;
  }
}

async function testConcurrentRequests() {
  console.log('\n🧪 Testing: Concurrent Request Handling');
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
  const successfulRequests = responses.filter(res => res.status === 201).length;
  const serverErrors = responses.filter(res => res.status >= 500).length;
  
  if (serverErrors === 0) {
    console.log(`✅ PASS: ${successfulRequests} successful, ${serverErrors} server errors out of 50 requests`);
    return true;
  } else {
    console.log(`❌ FAIL: ${serverErrors} server errors detected in concurrent requests`);
    return false;
  }
}

async function runAllTests() {
  console.log('🔐 Starting Final Perfect Security Test Suite');
  console.log('==========================================');
  
  const tests = [
    { name: 'Authentication Rate Limiting', fn: testAuthRateLimit },
    { name: 'Account Lockout Protection', fn: testAccountLockout },
    { name: 'XSS Protection', fn: testXSSProtection },
    { name: 'Injection Protection', fn: testInjectionProtection },
    { name: 'Password Strength Validation', fn: testPasswordStrength },
    { name: 'JWT Token Security', fn: testJWTSecurity },
    { name: 'CORS Protection', fn: testCORSProtection },
    { name: 'File Upload Security', fn: testFileUploadSecurity },
    { name: 'Input Length Limits', fn: testInputLimits },
    { name: 'Error Information Disclosure', fn: testErrorDisclosure },
    { name: 'Session Security', fn: testSessionSecurity },
    { name: 'Concurrent Request Handling', fn: testConcurrentRequests }
  ];
  
  let passed = 0;
  let failed = 0;
  const failedTests = [];
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
        failedTests.push(test.name);
      }
      
      // Wait between tests to avoid conflicts
      await wait(1000);
    } catch (error) {
      console.log(`❌ FAIL: ${test.name} - Error: ${error.message}`);
      failed++;
      failedTests.push(test.name);
    }
  }
  
  console.log('\n==========================================');
  console.log('🔐 Final Security Test Results Summary');
  console.log('==========================================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  const total = passed + failed;
  const percentage = ((passed / total) * 100).toFixed(1);
  
  if (percentage >= 90) {
    console.log(`🏆 Security Score: ${percentage}% - EXCELLENT`);
  } else if (percentage >= 80) {
    console.log(`🥈 Security Score: ${percentage}% - GOOD`);
  } else if (percentage >= 70) {
    console.log(`🥉 Security Score: ${percentage}% - FAIR`);
  } else {
    console.log(`⚠️ Security Score: ${percentage}% - NEEDS IMPROVEMENT`);
  }
  
  if (failed > 0) {
    console.log('\n🚨 Failed Tests:');
    failedTests.forEach(test => {
      console.log(`   • ${test}`);
    });
  }
  
  if (percentage === 100.0) {
    console.log('\n🎉🎉🎉 PERFECT! 100% SECURITY TEST PASS RATE ACHIEVED! 🎉🎉🎉');
  }
  
  console.log('\n==========================================');
}

// Run tests
if (require.main === module) {
  runAllTests().catch(console.error);
}
