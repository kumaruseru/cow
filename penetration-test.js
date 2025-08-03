#!/usr/bin/env node

/**
 * Advanced Penetration Testing Suite for Cow Social Network
 * Simulates real-world attack scenarios to identify exploitable vulnerabilities
 */

const axios = require('axios');
const fs = require('fs');

const BASE_URL = 'http://localhost:3002';

class PenetrationTester {
  constructor() {
    this.vulnerabilities = [];
    this.testResults = {
      passed: 0,
      failed: 0,
      exploitable: 0
    };
  }

  log(severity, vulnerability, description, exploitation, recommendation) {
    const vuln = {
      severity,
      vulnerability,
      description,
      exploitation,
      recommendation,
      timestamp: new Date().toISOString()
    };
    
    this.vulnerabilities.push(vuln);
    
    const icon = severity === 'CRITICAL' ? '🚨' : 
                 severity === 'HIGH' ? '⚠️' : 
                 severity === 'MEDIUM' ? '⚡' : '💡';
    
    console.log(`${icon} [${severity}] ${vulnerability}`);
    console.log(`   Description: ${description}`);
    console.log(`   Exploitation: ${exploitation}`);
    console.log(`   Recommendation: ${recommendation}\n`);
    
    if (severity === 'CRITICAL' || severity === 'HIGH') {
      this.testResults.exploitable++;
    }
  }

  async testSQLInjection() {
    console.log('\n🎯 Testing: SQL Injection Vulnerabilities');
    console.log('═'.repeat(50));
    
    const payloads = [
      "admin' OR '1'='1",
      "'; DROP TABLE users; --",
      "admin' UNION SELECT * FROM users --",
      "' OR 1=1#",
      "admin'/**/OR/**/'1'='1"
    ];
    
    for (const payload of payloads) {
      try {
        const response = await axios.post(`${BASE_URL}/api/auth/login`, {
          email: payload,
          password: 'anypassword'
        }, { validateStatus: () => true });
        
        // Check if SQL injection was successful
        if (response.status === 200 && response.data.success) {
          this.log('CRITICAL', 'SQL Injection Vulnerability',
            `SQL injection payload "${payload}" succeeded`,
            'Attacker can bypass authentication and access unauthorized data',
            'Use parameterized queries and input validation');
          return;
        } else if (response.status === 500) {
          this.log('HIGH', 'SQL Injection Error Disclosure',
            `SQL injection payload caused server error: ${payload}`,
            'Database errors may reveal schema information',
            'Implement proper error handling and input sanitization');
        }
      } catch (error) {
        // Check for database-related errors
        if (error.message.includes('SQL') || error.message.includes('database')) {
          this.log('MEDIUM', 'SQL Error Information Disclosure',
            `SQL error details exposed: ${error.message}`,
            'Attacker gains insight into database structure',
            'Hide database error details from responses');
        }
      }
    }
    
    console.log('✅ SQL Injection tests completed');
  }

  async testXSSVulnerabilities() {
    console.log('\n🎯 Testing: Cross-Site Scripting (XSS) Vulnerabilities');
    console.log('═'.repeat(50));
    
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      '<svg onload=alert("XSS")>',
      'javascript:alert("XSS")',
      '<iframe src="javascript:alert(`XSS`)"></iframe>',
      '<body onload=alert("XSS")>',
      '<div onclick="alert(`XSS`)">Click me</div>'
    ];
    
    for (const payload of xssPayloads) {
      try {
        // Test XSS in registration
        const response = await axios.post(`${BASE_URL}/api/auth/register`, {
          firstName: payload,
          lastName: 'Test',
          email: `xss${Date.now()}@test.com`,
          password: 'SecureP@ssw0rd123!'
        }, { validateStatus: () => true });
        
        if (response.data && JSON.stringify(response.data).includes(payload)) {
          this.log('HIGH', 'Stored XSS Vulnerability',
            `XSS payload reflected in response: ${payload}`,
            'Attacker can execute malicious scripts in user browsers',
            'Implement proper input sanitization and output encoding');
        } else if (response.data && JSON.stringify(response.data).includes('<script>')) {
          this.log('MEDIUM', 'Potential XSS Vulnerability',
            'Script tags detected in response',
            'May allow script execution',
            'Review input sanitization implementation');
        }
      } catch (error) {
        // XSS test handled
      }
    }
    
    console.log('✅ XSS vulnerability tests completed');
  }

  async testAuthenticationBypass() {
    console.log('\n🎯 Testing: Authentication Bypass Vulnerabilities');
    console.log('═'.repeat(50));
    
    // Test 1: Missing authentication headers
    try {
      const response = await axios.get(`${BASE_URL}/api/user`, {
        validateStatus: () => true
      });
      
      if (response.status === 200) {
        this.log('CRITICAL', 'Missing Authentication',
          'Protected endpoint accessible without authentication',
          'Unauthorized access to user data',
          'Implement proper authentication middleware on all protected routes');
      }
    } catch (error) {
      // Expected behavior
    }
    
    // Test 2: Weak JWT tokens
    try {
      const response = await axios.get(`${BASE_URL}/api/user`, {
        headers: { Authorization: 'Bearer fake.jwt.token' },
        validateStatus: () => true
      });
      
      if (response.status === 200) {
        this.log('CRITICAL', 'Weak JWT Validation',
          'Fake JWT token accepted by server',
          'Complete authentication bypass',
          'Implement proper JWT signature validation');
      }
    } catch (error) {
      // Expected behavior
    }
    
    // Test 3: Session fixation
    try {
      const loginResponse1 = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: 'test@test.com',
        password: 'wrongpassword'
      }, { validateStatus: () => true });
      
      if (loginResponse1.data && loginResponse1.data.sessionId) {
        const loginResponse2 = await axios.post(`${BASE_URL}/api/auth/login`, {
          email: 'test@test.com',
          password: 'wrongpassword'
        }, { validateStatus: () => true });
        
        if (loginResponse2.data && loginResponse1.data.sessionId === loginResponse2.data.sessionId) {
          this.log('MEDIUM', 'Session Fixation Vulnerability',
            'Same session ID reused across login attempts',
            'Session hijacking possible',
            'Generate new session ID for each authentication');
        }
      }
    } catch (error) {
      // Test handled
    }
    
    console.log('✅ Authentication bypass tests completed');
  }

  async testInsecureDirectObjectReferences() {
    console.log('\n🎯 Testing: Insecure Direct Object References (IDOR)');
    console.log('═'.repeat(50));
    
    // Register two test users
    const user1Email = `idor1.${Date.now()}@test.com`;
    const user2Email = `idor2.${Date.now()}@test.com`;
    
    try {
      // Register users
      await axios.post(`${BASE_URL}/api/auth/register`, {
        firstName: 'IDOR',
        lastName: 'Test1',
        email: user1Email,
        password: 'SecureP@ssw0rd123!'
      });
      
      await axios.post(`${BASE_URL}/api/auth/register`, {
        firstName: 'IDOR',
        lastName: 'Test2',
        email: user2Email,
        password: 'SecureP@ssw0rd123!'
      });
      
      // Login as user1
      const login1 = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: user1Email,
        password: 'SecureP@ssw0rd123!'
      });
      
      const token1 = login1.data.accessToken;
      const user1Id = login1.data.user.id;
      
      // Try to access another user's data
      try {
        const otherUserResponse = await axios.get(`${BASE_URL}/api/user/${user1Id + 1}`, {
          headers: { Authorization: `Bearer ${token1}` },
          validateStatus: () => true
        });
        
        if (otherUserResponse.status === 200 && otherUserResponse.data.user) {
          this.log('HIGH', 'Insecure Direct Object Reference',
            'User can access other users\' data by manipulating user ID',
            'Unauthorized access to sensitive user information',
            'Implement proper authorization checks for resource access');
        }
      } catch (error) {
        // IDOR test handled
      }
    } catch (error) {
      // Setup failed
    }
    
    console.log('✅ IDOR tests completed');
  }

  async testSecurityMisconfiguration() {
    console.log('\n🎯 Testing: Security Misconfiguration');
    console.log('═'.repeat(50));
    
    // Test 1: Missing security headers
    try {
      const response = await axios.get(`${BASE_URL}/`, {
        validateStatus: () => true
      });
      
      const headers = response.headers;
      
      if (!headers['x-frame-options']) {
        this.log('MEDIUM', 'Missing X-Frame-Options Header',
          'No clickjacking protection',
          'Site can be embedded in malicious iframes',
          'Add X-Frame-Options: DENY header');
      }
      
      if (!headers['x-content-type-options']) {
        this.log('MEDIUM', 'Missing X-Content-Type-Options Header',
          'No MIME type sniffing protection',
          'Browser may interpret files as executable',
          'Add X-Content-Type-Options: nosniff header');
      }
      
      if (!headers['strict-transport-security']) {
        this.log('MEDIUM', 'Missing HSTS Header',
          'No HTTP Strict Transport Security',
          'Man-in-the-middle attacks possible',
          'Add Strict-Transport-Security header');
      }
    } catch (error) {
      // Test handled
    }
    
    // Test 2: Debug information exposure
    try {
      const response = await axios.get(`${BASE_URL}/debug`, {
        validateStatus: () => true
      });
      
      if (response.status === 200 && response.data) {
        this.log('HIGH', 'Debug Information Exposure',
          'Debug endpoint accessible in production',
          'Sensitive system information exposed',
          'Disable debug endpoints in production');
      }
    } catch (error) {
      // Expected
    }
    
    console.log('✅ Security misconfiguration tests completed');
  }

  async testFileUploadVulnerabilities() {
    console.log('\n🎯 Testing: File Upload Vulnerabilities');
    console.log('═'.repeat(50));
    
    // Register and login first
    const testEmail = `upload.${Date.now()}@test.com`;
    
    try {
      await axios.post(`${BASE_URL}/api/auth/register`, {
        firstName: 'Upload',
        lastName: 'Test',
        email: testEmail,
        password: 'SecureP@ssw0rd123!'
      });
      
      const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: testEmail,
        password: 'SecureP@ssw0rd123!'
      });
      
      const token = loginResponse.data.accessToken;
      
      // Test malicious file uploads
      const maliciousFiles = [
        { name: 'shell.php', content: '<?php system($_GET["cmd"]); ?>', type: 'application/x-php' },
        { name: 'script.js', content: 'alert("XSS")', type: 'application/javascript' },
        { name: 'exploit.exe', content: 'MZ...', type: 'application/octet-stream' },
        { name: 'large.txt', content: 'A'.repeat(50 * 1024 * 1024), type: 'text/plain' } // 50MB
      ];
      
      for (const file of maliciousFiles) {
        try {
          const FormData = require('form-data');
          const form = new FormData();
          form.append('file', Buffer.from(file.content), {
            filename: file.name,
            contentType: file.type
          });
          
          const uploadResponse = await axios.post(`${BASE_URL}/api/upload`, form, {
            headers: {
              ...form.getHeaders(),
              'Authorization': `Bearer ${token}`
            },
            validateStatus: () => true,
            timeout: 5000
          });
          
          if (uploadResponse.status === 200) {
            this.log('HIGH', 'Malicious File Upload Accepted',
              `Dangerous file type accepted: ${file.name}`,
              'Code execution or DoS attacks possible',
              'Implement strict file type validation and size limits');
          }
        } catch (error) {
          if (error.code === 'ECONNABORTED') {
            this.log('MEDIUM', 'Large File Upload DoS',
              'Large file upload caused timeout',
              'Denial of Service through resource exhaustion',
              'Implement file size limits and upload timeouts');
          }
        }
      }
    } catch (error) {
      // Upload test setup failed
    }
    
    console.log('✅ File upload vulnerability tests completed');
  }

  async testBusinessLogicFlaws() {
    console.log('\n🎯 Testing: Business Logic Vulnerabilities');
    console.log('═'.repeat(50));
    
    // Test 1: Race condition in user registration
    const testEmail = `race.${Date.now()}@test.com`;
    
    try {
      const registrationPromises = [];
      for (let i = 0; i < 5; i++) {
        registrationPromises.push(
          axios.post(`${BASE_URL}/api/auth/register`, {
            firstName: 'Race',
            lastName: 'Test',
            email: testEmail,
            password: 'SecureP@ssw0rd123!'
          }, { validateStatus: () => true })
        );
      }
      
      const results = await Promise.all(registrationPromises);
      const successfulRegistrations = results.filter(r => r.status === 201).length;
      
      if (successfulRegistrations > 1) {
        this.log('MEDIUM', 'Race Condition in Registration',
          'Multiple accounts created with same email',
          'Data integrity issues and potential account takeover',
          'Implement proper database constraints and atomic operations');
      }
    } catch (error) {
      // Race condition test handled
    }
    
    // Test 2: Password reset without proper validation
    try {
      const resetResponse = await axios.post(`${BASE_URL}/api/auth/reset-password`, {
        email: 'admin@example.com',
        newPassword: 'hacked123'
      }, { validateStatus: () => true });
      
      if (resetResponse.status === 200) {
        this.log('CRITICAL', 'Insecure Password Reset',
          'Password reset without proper verification',
          'Account takeover possible',
          'Implement secure password reset with email verification');
      }
    } catch (error) {
      // Expected
    }
    
    console.log('✅ Business logic vulnerability tests completed');
  }

  async testPrivilegeEscalation() {
    console.log('\n🎯 Testing: Privilege Escalation');
    console.log('═'.repeat(50));
    
    // Register regular user
    const userEmail = `priv.${Date.now()}@test.com`;
    
    try {
      await axios.post(`${BASE_URL}/api/auth/register`, {
        firstName: 'Privilege',
        lastName: 'Test',
        email: userEmail,
        password: 'SecureP@ssw0rd123!'
      });
      
      const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: userEmail,
        password: 'SecureP@ssw0rd123!'
      });
      
      const token = loginResponse.data.accessToken;
      
      // Test admin endpoint access
      try {
        const adminResponse = await axios.get(`${BASE_URL}/api/admin/users`, {
          headers: { Authorization: `Bearer ${token}` },
          validateStatus: () => true
        });
        
        if (adminResponse.status === 200) {
          this.log('CRITICAL', 'Horizontal Privilege Escalation',
            'Regular user can access admin endpoints',
            'Unauthorized access to administrative functions',
            'Implement proper role-based access control');
        }
      } catch (error) {
        // Expected
      }
      
      // Test user modification
      try {
        const modifyResponse = await axios.put(`${BASE_URL}/api/user`, {
          role: 'admin',
          permissions: ['all']
        }, {
          headers: { Authorization: `Bearer ${token}` },
          validateStatus: () => true
        });
        
        if (modifyResponse.status === 200) {
          this.log('HIGH', 'Privilege Escalation via User Modification',
            'User can modify their own privileges',
            'Self-privilege escalation to admin',
            'Validate user permissions for sensitive operations');
        }
      } catch (error) {
        // Expected
      }
    } catch (error) {
      // Setup failed
    }
    
    console.log('✅ Privilege escalation tests completed');
  }

  async generatePenetrationReport() {
    const report = {
      timestamp: new Date().toISOString(),
      testSummary: {
        totalVulnerabilities: this.vulnerabilities.length,
        criticalVulnerabilities: this.vulnerabilities.filter(v => v.severity === 'CRITICAL').length,
        highVulnerabilities: this.vulnerabilities.filter(v => v.severity === 'HIGH').length,
        mediumVulnerabilities: this.vulnerabilities.filter(v => v.severity === 'MEDIUM').length,
        lowVulnerabilities: this.vulnerabilities.filter(v => v.severity === 'LOW').length,
        exploitableVulnerabilities: this.testResults.exploitable
      },
      riskAssessment: this.calculateRiskScore(),
      vulnerabilities: this.vulnerabilities,
      recommendations: this.generateSecurityRecommendations()
    };
    
    fs.writeFileSync('penetration-test-report.json', JSON.stringify(report, null, 2));
    return report;
  }

  calculateRiskScore() {
    const critical = this.vulnerabilities.filter(v => v.severity === 'CRITICAL').length;
    const high = this.vulnerabilities.filter(v => v.severity === 'HIGH').length;
    const medium = this.vulnerabilities.filter(v => v.severity === 'MEDIUM').length;
    
    const score = (critical * 10) + (high * 7) + (medium * 4);
    
    let level = 'LOW';
    if (score >= 50) level = 'CRITICAL';
    else if (score >= 30) level = 'HIGH';
    else if (score >= 15) level = 'MEDIUM';
    
    return { score, level };
  }

  generateSecurityRecommendations() {
    const recommendations = [
      'Implement comprehensive input validation and sanitization',
      'Add proper authentication and authorization checks',
      'Use parameterized queries to prevent SQL injection',
      'Implement security headers (CSP, HSTS, X-Frame-Options)',
      'Add rate limiting and account lockout mechanisms',
      'Implement proper session management',
      'Add comprehensive error handling without information disclosure',
      'Implement file upload security controls',
      'Add business logic validation',
      'Implement proper role-based access control',
      'Regular security testing and code reviews',
      'Keep dependencies updated and monitor for vulnerabilities'
    ];
    
    return recommendations;
  }
}

async function runPenetrationTest() {
  console.log('🔓 COW SOCIAL NETWORK - PENETRATION TESTING SUITE');
  console.log('═'.repeat(60));
  console.log('Simulating real-world attack scenarios...\n');
  
  const tester = new PenetrationTester();
  
  try {
    await tester.testSQLInjection();
    await tester.testXSSVulnerabilities();
    await tester.testAuthenticationBypass();
    await tester.testInsecureDirectObjectReferences();
    await tester.testSecurityMisconfiguration();
    await tester.testFileUploadVulnerabilities();
    await tester.testBusinessLogicFlaws();
    await tester.testPrivilegeEscalation();
    
    const report = await tester.generatePenetrationReport();
    
    console.log('\n📊 PENETRATION TEST SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Total Vulnerabilities Found: ${report.testSummary.totalVulnerabilities}`);
    console.log(`Critical: ${report.testSummary.criticalVulnerabilities}`);
    console.log(`High: ${report.testSummary.highVulnerabilities}`);
    console.log(`Medium: ${report.testSummary.mediumVulnerabilities}`);
    console.log(`Exploitable: ${report.testSummary.exploitableVulnerabilities}`);
    console.log(`Risk Score: ${report.riskAssessment.score} (${report.riskAssessment.level})`);
    console.log('\n💾 Detailed report saved to: penetration-test-report.json');
    
    return report;
  } catch (error) {
    console.error('Penetration test failed:', error);
  }
}

module.exports = PenetrationTester;

if (require.main === module) {
  runPenetrationTest().catch(console.error);
}
