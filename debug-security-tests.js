#!/usr/bin/env node

/**
 * Debug Test for Individual Security Features
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function debugAuthRateLimit() {
  console.log('\n=== DEBUG: Authentication Rate Limiting ===');
  
  const testEmail = `rate.test.${Date.now()}@example.com`;
  
  for (let i = 1; i <= 12; i++) {
    try {
      const response = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: testEmail,
        password: 'wrongpassword'
      }, { validateStatus: () => true });
      
      console.log(`Request ${i}: Status ${response.status} - ${response.data?.error || 'Success'}`);
      
      if (response.status === 429) {
        console.log(`✅ Rate limiting triggered at request ${i}`);
        return true;
      }
    } catch (error) {
      console.log(`Request ${i}: Error - ${error.message}`);
    }
    
    // Small delay to avoid overwhelming
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('❌ Rate limiting not working');
  return false;
}

async function debugAccountLockout() {
  console.log('\n=== DEBUG: Account Lockout Protection ===');
  
  const testEmail = `lockout.test.${Date.now()}@example.com`;
  
  // Register user first
  try {
    const regResponse = await axios.post(`${BASE_URL}/api/auth/register`, {
      firstName: 'Test',
      lastName: 'User',
      email: testEmail,
      password: 'TestPassword123!'
    }, { validateStatus: () => true });
    
    console.log(`Registration: Status ${regResponse.status}`);
  } catch (error) {
    console.log(`Registration Error: ${error.message}`);
  }
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Try failed logins
  for (let i = 1; i <= 7; i++) {
    try {
      const response = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: testEmail,
        password: 'wrongpassword'
      }, { validateStatus: () => true });
      
      console.log(`Failed Login ${i}: Status ${response.status} - ${response.data?.error || 'Success'}`);
      
      if (response.status === 423) {
        console.log(`✅ Account lockout triggered at attempt ${i}`);
        return true;
      }
    } catch (error) {
      console.log(`Failed Login ${i}: Error - ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log('❌ Account lockout not working');
  return false;
}

async function debugFileUpload() {
  console.log('\n=== DEBUG: File Upload Security ===');
  
  // First, get a valid token
  const testEmail = `upload.test.${Date.now()}@example.com`;
  
  try {
    // Register
    await axios.post(`${BASE_URL}/api/auth/register`, {
      firstName: 'Upload',
      lastName: 'Test',
      email: testEmail,
      password: 'TestPassword123!'
    }, { validateStatus: () => true });
    
    // Login
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: testEmail,
      password: 'TestPassword123!'
    }, { validateStatus: () => true });
    
    if (loginResponse.data.accessToken) {
      console.log('✅ Got valid token for upload test');
      
      // Try uploading a malicious file
      const FormData = require('form-data');
      const form = new FormData();
      form.append('file', Buffer.from('<?php echo "hack"; ?>'), {
        filename: 'malicious.php',
        contentType: 'application/x-php'
      });
      
      try {
        const uploadResponse = await axios.post(`${BASE_URL}/api/upload`, form, {
          headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer ${loginResponse.data.accessToken}`
          },
          validateStatus: () => true
        });
        
        console.log(`Upload attempt: Status ${uploadResponse.status} - ${uploadResponse.data?.error || 'Success'}`);
        
        if (uploadResponse.status === 400 && uploadResponse.data?.error?.includes('file type')) {
          console.log('✅ File upload security working - malicious file rejected');
          return true;
        }
      } catch (error) {
        console.log(`Upload Error: ${error.message}`);
      }
    }
  } catch (error) {
    console.log(`Setup Error: ${error.message}`);
  }
  
  console.log('❌ File upload security not working');
  return false;
}

async function debugSession() {
  console.log('\n=== DEBUG: Session Security ===');
  
  try {
    // Test with invalid session
    const response = await axios.get(`${BASE_URL}/api/session/validate`, {
      headers: {
        'X-Session-ID': 'invalid-session-id'
      },
      validateStatus: () => true
    });
    
    console.log(`Invalid session test: Status ${response.status} - ${response.data?.error || 'Success'}`);
    
    if (response.status === 401) {
      console.log('✅ Session security working - invalid session rejected');
      return true;
    }
  } catch (error) {
    console.log(`Session Error: ${error.message}`);
  }
  
  console.log('❌ Session security not working');
  return false;
}

async function runAllDebugTests() {
  console.log('🔍 Starting Debug Tests for Failed Security Features\n');
  
  const results = [];
  
  results.push({ name: 'Auth Rate Limiting', pass: await debugAuthRateLimit() });
  results.push({ name: 'Account Lockout', pass: await debugAccountLockout() });
  results.push({ name: 'File Upload Security', pass: await debugFileUpload() });
  results.push({ name: 'Session Security', pass: await debugSession() });
  
  console.log('\n=== DEBUG RESULTS ===');
  results.forEach(result => {
    console.log(`${result.pass ? '✅' : '❌'} ${result.name}`);
  });
  
  const passCount = results.filter(r => r.pass).length;
  console.log(`\nTotal: ${passCount}/${results.length} tests passed`);
}

// Run if called directly
if (require.main === module) {
  runAllDebugTests().catch(console.error);
}
