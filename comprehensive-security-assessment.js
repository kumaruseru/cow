#!/usr/bin/env node

/**
 * Comprehensive Security Assessment and Vulnerability Analysis
 * Real-world security testing for Cow Social Network
 */

const fs = require('fs');
const path = require('path');

class SecurityAssessment {
  constructor() {
    this.findings = [];
    this.criticalCount = 0;
    this.highCount = 0;
    this.mediumCount = 0;
    this.lowCount = 0;
    this.infoCount = 0;
  }

  addFinding(severity, category, title, description, impact, remediation, files = [], cwe = null) {
    const finding = {
      id: `VULN-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      severity,
      category,
      title,
      description,
      impact,
      remediation,
      affectedFiles: files,
      cwe,
      timestamp: new Date().toISOString()
    };

    this.findings.push(finding);
    
    // Count by severity
    switch (severity) {
      case 'CRITICAL': this.criticalCount++; break;
      case 'HIGH': this.highCount++; break;
      case 'MEDIUM': this.mediumCount++; break;
      case 'LOW': this.lowCount++; break;
      case 'INFO': this.infoCount++; break;
    }

    // Log to console
    const icons = { CRITICAL: '🚨', HIGH: '⚠️', MEDIUM: '⚡', LOW: '💡', INFO: 'ℹ️' };
    console.log(`${icons[severity]} [${severity}] ${title}`);
    console.log(`   Category: ${category}`);
    console.log(`   Description: ${description}`);
    console.log(`   Impact: ${impact}`);
    console.log(`   Remediation: ${remediation}`);
    if (files.length > 0) {
      console.log(`   Affected Files: ${files.join(', ')}`);
    }
    if (cwe) {
      console.log(`   CWE: ${cwe}`);
    }
    console.log();
  }

  async analyzeCodebase() {
    console.log('🔍 COMPREHENSIVE SECURITY ASSESSMENT');
    console.log('═'.repeat(60));
    console.log('Analyzing codebase for security vulnerabilities...\n');

    await this.analyzeServerSecurity();
    await this.analyzeAuthenticationSecurity();
    await this.analyzeDatabaseSecurity();
    await this.analyzeInputValidation();
    await this.analyzeFileUploadSecurity();
    await this.analyzeSessionManagement();
    await this.analyzeCryptographicImplementation();
    await this.analyzeErrorHandling();
    await this.analyzeConfigurationSecurity();
    await this.analyzeClientSideSecurity();
    await this.analyzeDependencySecurity();
    await this.analyzeLoggingSecurity();
  }

  async analyzeServerSecurity() {
    console.log('🖥️ Analyzing Server Security Configuration...');
    console.log('─'.repeat(50));

    // Check main server file
    try {
      const serverContent = fs.readFileSync('server.js', 'utf8');
      
      // Check for security headers
      if (!serverContent.includes('helmet')) {
        this.addFinding('HIGH', 'Security Headers', 'Missing Security Headers Implementation',
          'Server does not implement comprehensive security headers',
          'Lack of protection against common web vulnerabilities like XSS, clickjacking, MIME sniffing',
          'Implement Helmet.js middleware for comprehensive security headers',
          ['server.js'], 'CWE-200');
      }

      // Check for rate limiting
      if (!serverContent.includes('express-rate-limit') && !serverContent.includes('rateLimits')) {
        this.addFinding('HIGH', 'Rate Limiting', 'Missing Rate Limiting Protection',
          'No rate limiting implemented to prevent brute force attacks',
          'Vulnerable to brute force attacks, DDoS, and automated abuse',
          'Implement express-rate-limit middleware for API endpoints',
          ['server.js'], 'CWE-307');
      }

      // Check for input validation
      if (!serverContent.includes('express-validator') && !serverContent.includes('joi')) {
        this.addFinding('MEDIUM', 'Input Validation', 'Insufficient Input Validation Framework',
          'No comprehensive input validation framework detected',
          'Potential for injection attacks and data corruption',
          'Implement express-validator or Joi for robust input validation',
          ['server.js'], 'CWE-20');
      }

      // Check for CORS configuration
      if (serverContent.includes('app.use(cors())')) {
        this.addFinding('MEDIUM', 'CORS Configuration', 'Permissive CORS Configuration',
          'CORS is configured without specific origin restrictions',
          'Potential for cross-origin attacks from malicious websites',
          'Configure CORS with specific allowed origins and methods',
          ['server.js'], 'CWE-942');
      }

      // Check for debug information exposure
      if (serverContent.includes('console.log') || serverContent.includes('console.error')) {
        this.addFinding('LOW', 'Information Disclosure', 'Debug Information in Production Code',
          'Console logging statements found in server code',
          'Potential information disclosure in production environment',
          'Remove debug statements or use proper logging framework',
          ['server.js'], 'CWE-209');
      }

    } catch (error) {
      this.addFinding('INFO', 'Code Analysis', 'Cannot Analyze Server File',
        'Unable to read server.js file for security analysis',
        'Cannot assess server-level security implementations',
        'Ensure server.js file is accessible for security review',
        ['server.js']);
    }
  }

  async analyzeAuthenticationSecurity() {
    console.log('🔐 Analyzing Authentication Security...');
    console.log('─'.repeat(50));

    try {
      const authContent = fs.readFileSync('middleware/auth.js', 'utf8');
      
      // Check JWT secret configuration
      if (authContent.includes('process.env.JWT_SECRET')) {
        this.addFinding('INFO', 'JWT Configuration', 'JWT Secret from Environment',
          'JWT secret is properly loaded from environment variables',
          'Good security practice - reduces hardcoded secrets',
          'Ensure JWT secret is strong (32+ characters) in production',
          ['middleware/auth.js']);
      } else {
        this.addFinding('CRITICAL', 'Authentication', 'Hardcoded JWT Secret',
          'JWT secret appears to be hardcoded in source code',
          'Complete compromise of authentication system if code is exposed',
          'Move JWT secret to environment variables immediately',
          ['middleware/auth.js'], 'CWE-798');
      }

      // Check for weak token expiration
      if (authContent.includes("'15m'") || authContent.includes('"15m"')) {
        this.addFinding('LOW', 'Session Management', 'Short Token Expiration',
          'JWT access tokens expire in 15 minutes',
          'May impact user experience with frequent re-authentication',
          'Consider longer expiration with proper refresh token mechanism',
          ['middleware/auth.js']);
      }

      // Check for refresh token implementation
      if (!authContent.includes('refreshToken') && !authContent.includes('refresh_token')) {
        this.addFinding('MEDIUM', 'Authentication', 'Missing Refresh Token Mechanism',
          'No refresh token implementation detected',
          'Users must re-authenticate frequently, poor user experience',
          'Implement secure refresh token mechanism',
          ['middleware/auth.js'], 'CWE-287');
      }

    } catch (error) {
      this.addFinding('HIGH', 'Authentication', 'Missing Authentication Middleware',
        'Cannot find authentication middleware file',
        'Authentication security cannot be verified',
        'Ensure proper authentication middleware is implemented',
        ['middleware/auth.js']);
    }
  }

  async analyzeDatabaseSecurity() {
    console.log('🗄️ Analyzing Database Security...');
    console.log('─'.repeat(50));

    try {
      const dbContent = fs.readFileSync('config/database.js', 'utf8');
      
      // Check for MongoDB connection security
      if (dbContent.includes('mongodb://') && !dbContent.includes('ssl=true')) {
        this.addFinding('MEDIUM', 'Database Security', 'Unencrypted Database Connection',
          'MongoDB connection may not use SSL/TLS encryption',
          'Database traffic could be intercepted in transit',
          'Enable SSL/TLS for MongoDB connections in production',
          ['config/database.js'], 'CWE-319');
      }

      // Check for connection string in code
      if (dbContent.includes('mongodb://') && !dbContent.includes('process.env')) {
        this.addFinding('HIGH', 'Database Security', 'Hardcoded Database Connection',
          'Database connection string appears to be hardcoded',
          'Database credentials exposed in source code',
          'Move database connection string to environment variables',
          ['config/database.js'], 'CWE-798');
      }

      // Check User model for password security
      const userModelContent = fs.readFileSync('models/User.js', 'utf8');
      
      // Check password hashing
      if (!userModelContent.includes('bcrypt') && !userModelContent.includes('argon2')) {
        this.addFinding('CRITICAL', 'Authentication', 'Weak Password Storage',
          'No secure password hashing algorithm detected',
          'Passwords stored in plaintext or weak encryption',
          'Implement bcrypt or Argon2 for password hashing',
          ['models/User.js'], 'CWE-257');
      }

      // Check for password field exposure
      if (!userModelContent.includes('toJSON') || !userModelContent.includes('delete ret.password')) {
        this.addFinding('HIGH', 'Data Exposure', 'Password Field Not Hidden',
          'Password field may be exposed in JSON responses',
          'Password hashes could be leaked to clients',
          'Implement toJSON transform to exclude password field',
          ['models/User.js'], 'CWE-200');
      }

    } catch (error) {
      this.addFinding('MEDIUM', 'Database Security', 'Cannot Analyze Database Configuration',
        'Unable to read database configuration files',
        'Database security cannot be fully assessed',
        'Ensure database configuration files are accessible for review',
        ['config/database.js', 'models/User.js']);
    }
  }

  async analyzeInputValidation() {
    console.log('📝 Analyzing Input Validation Security...');
    console.log('─'.repeat(50));

    try {
      const validationContent = fs.readFileSync('middleware/validation.js', 'utf8');
      
      // Check for XSS protection
      if (!validationContent.includes('xss') && !validationContent.includes('sanitize')) {
        this.addFinding('HIGH', 'Input Validation', 'Missing XSS Protection',
          'No XSS sanitization detected in input validation',
          'Vulnerable to stored and reflected XSS attacks',
          'Implement XSS protection in input validation middleware',
          ['middleware/validation.js'], 'CWE-79');
      }

      // Check for SQL injection protection
      if (!validationContent.includes('mongo-sanitize') && !validationContent.includes('escape')) {
        this.addFinding('HIGH', 'Input Validation', 'Missing NoSQL Injection Protection',
          'No NoSQL injection protection detected',
          'Vulnerable to NoSQL injection attacks',
          'Implement mongo-sanitize for NoSQL injection protection',
          ['middleware/validation.js'], 'CWE-943');
      }

      // Check for file upload validation
      const serverContent = fs.readFileSync('server.js', 'utf8');
      if (serverContent.includes('multer') && !serverContent.includes('fileFilter')) {
        this.addFinding('MEDIUM', 'File Upload', 'Insufficient File Upload Validation',
          'File upload middleware lacks proper file type validation',
          'Malicious files could be uploaded to the server',
          'Implement strict file type and size validation',
          ['server.js'], 'CWE-434');
      }

    } catch (error) {
      this.addFinding('MEDIUM', 'Input Validation', 'Missing Input Validation Middleware',
        'Cannot find input validation middleware',
        'Input validation security cannot be assessed',
        'Implement comprehensive input validation middleware',
        ['middleware/validation.js']);
    }
  }

  async analyzeFileUploadSecurity() {
    console.log('📁 Analyzing File Upload Security...');
    console.log('─'.repeat(50));

    // Check if uploads directory exists and is properly secured
    if (fs.existsSync('uploads')) {
      this.addFinding('INFO', 'File Upload', 'Uploads Directory Present',
        'File upload functionality detected',
        'File uploads require careful security consideration',
        'Ensure uploaded files are properly validated and stored securely',
        ['uploads/']);

      // Check for executable files in uploads
      try {
        const uploadFiles = fs.readdirSync('uploads', { recursive: true });
        const dangerousExtensions = ['.php', '.jsp', '.asp', '.exe', '.sh', '.bat', '.js', '.html'];
        
        uploadFiles.forEach(file => {
          const ext = path.extname(file).toLowerCase();
          if (dangerousExtensions.includes(ext)) {
            this.addFinding('HIGH', 'File Upload', 'Dangerous File in Uploads Directory',
              `Potentially dangerous file detected: ${file}`,
              'Uploaded executable files could lead to remote code execution',
              'Remove dangerous files and implement strict file type validation',
              [`uploads/${file}`], 'CWE-434');
          }
        });
      } catch (error) {
        // Directory access error
      }
    }
  }

  async analyzeSessionManagement() {
    console.log('🔑 Analyzing Session Management...');
    console.log('─'.repeat(50));

    try {
      const serverContent = fs.readFileSync('server.js', 'utf8');
      
      // Check for session secret
      if (serverContent.includes('express-session') && !serverContent.includes('process.env.SESSION_SECRET')) {
        this.addFinding('HIGH', 'Session Management', 'Weak Session Secret',
          'Session secret not loaded from environment variables',
          'Session security compromised if secret is predictable',
          'Use strong session secret from environment variables',
          ['server.js'], 'CWE-798');
      }

      // Check for secure session configuration
      if (serverContent.includes('express-session') && !serverContent.includes('httpOnly: true')) {
        this.addFinding('MEDIUM', 'Session Management', 'Insecure Session Configuration',
          'Session cookies not configured with httpOnly flag',
          'Session cookies vulnerable to XSS attacks',
          'Configure session cookies with httpOnly and secure flags',
          ['server.js'], 'CWE-1004');
      }

    } catch (error) {
      // Session analysis error
    }
  }

  async analyzeCryptographicImplementation() {
    console.log('🔒 Analyzing Cryptographic Implementation...');
    console.log('─'.repeat(50));

    try {
      const files = ['server.js', 'middleware/auth.js', 'models/User.js'];
      
      for (const file of files) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          
          // Check for weak cryptographic algorithms
          if (content.includes('md5') || content.includes('sha1')) {
            this.addFinding('HIGH', 'Cryptography', 'Weak Cryptographic Algorithm',
              `Weak hashing algorithm detected in ${file}`,
              'Vulnerable to collision attacks and rainbow table attacks',
              'Use SHA-256 or stronger cryptographic algorithms',
              [file], 'CWE-327');
          }

          // Check for hardcoded cryptographic keys
          if (content.match(/['"]\w{32,}['"]/)) {
            this.addFinding('MEDIUM', 'Cryptography', 'Potential Hardcoded Cryptographic Key',
              `Potential hardcoded key detected in ${file}`,
              'Cryptographic keys in source code compromise security',
              'Move all cryptographic keys to environment variables',
              [file], 'CWE-798');
          }
        }
      }
    } catch (error) {
      // Crypto analysis error
    }
  }

  async analyzeErrorHandling() {
    console.log('❌ Analyzing Error Handling...');
    console.log('─'.repeat(50));

    try {
      const errorHandlerContent = fs.readFileSync('middleware/errorHandler.js', 'utf8');
      
      // Check for information disclosure in error messages
      if (errorHandlerContent.includes('err.stack') && !errorHandlerContent.includes('NODE_ENV')) {
        this.addFinding('MEDIUM', 'Information Disclosure', 'Stack Traces in Production',
          'Error handler may expose stack traces in production',
          'Internal application details leaked to attackers',
          'Hide detailed error information in production environment',
          ['middleware/errorHandler.js'], 'CWE-209');
      }

      // Check for proper error logging
      if (!errorHandlerContent.includes('logger') && !errorHandlerContent.includes('winston')) {
        this.addFinding('LOW', 'Monitoring', 'Insufficient Error Logging',
          'Error handler does not implement comprehensive logging',
          'Security incidents may go undetected',
          'Implement proper error logging for security monitoring',
          ['middleware/errorHandler.js'], 'CWE-532');
      }

    } catch (error) {
      this.addFinding('MEDIUM', 'Error Handling', 'Missing Error Handler',
        'Cannot find error handling middleware',
        'Unhandled errors may expose sensitive information',
        'Implement comprehensive error handling middleware',
        ['middleware/errorHandler.js']);
    }
  }

  async analyzeConfigurationSecurity() {
    console.log('⚙️ Analyzing Configuration Security...');
    console.log('─'.repeat(50));

    // Check for .env file
    if (fs.existsSync('.env')) {
      this.addFinding('INFO', 'Configuration', 'Environment File Present',
        '.env file found - good practice for configuration',
        'Environment variables properly separated from code',
        'Ensure .env file is not committed to version control',
        ['.env']);
      
      try {
        const envContent = fs.readFileSync('.env', 'utf8');
        
        // Check for weak passwords in env
        if (envContent.includes('PASSWORD=123') || envContent.includes('PASSWORD=admin')) {
          this.addFinding('CRITICAL', 'Configuration', 'Weak Default Password',
            'Weak default password found in environment configuration',
            'Easy to guess passwords compromise entire system',
            'Use strong, randomly generated passwords',
            ['.env'], 'CWE-521');
        }

        // Check for production secrets
        if (envContent.includes('SECRET=test') || envContent.includes('SECRET=dev')) {
          this.addFinding('HIGH', 'Configuration', 'Weak Cryptographic Secret',
            'Weak cryptographic secret in environment configuration',
            'Predictable secrets compromise cryptographic security',
            'Generate strong, random secrets for production',
            ['.env'], 'CWE-798');
        }

      } catch (error) {
        // Env file read error
      }
    } else {
      this.addFinding('MEDIUM', 'Configuration', 'Missing Environment Configuration',
        'No .env file found for environment configuration',
        'Configuration may be hardcoded in application files',
        'Create .env file for secure environment configuration',
        ['.env']);
    }

    // Check package.json for security
    if (fs.existsSync('package.json')) {
      const packageContent = fs.readFileSync('package.json', 'utf8');
      const packageJson = JSON.parse(packageContent);
      
      // Check for outdated dependencies (this is a simplified check)
      if (packageJson.dependencies) {
        const oldPackages = ['express-validator@5', 'bcrypt@3', 'jsonwebtoken@8'];
        
        Object.entries(packageJson.dependencies).forEach(([pkg, version]) => {
          if (version.startsWith('^3') || version.startsWith('^4')) {
            this.addFinding('LOW', 'Dependencies', 'Potentially Outdated Dependencies',
              `Package ${pkg} may be using an older version`,
              'Outdated packages may contain known vulnerabilities',
              'Update dependencies to latest secure versions',
              ['package.json'], 'CWE-1104');
          }
        });
      }
    }
  }

  async analyzeClientSideSecurity() {
    console.log('🌐 Analyzing Client-Side Security...');
    console.log('─'.repeat(50));

    // Check HTML files for security issues
    const htmlFiles = ['index.html', 'login.html', 'register.html'];
    
    htmlFiles.forEach(file => {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        
        // Check for inline scripts
        if (content.includes('<script>')) {
          this.addFinding('MEDIUM', 'Client-Side Security', 'Inline JavaScript Detected',
            `Inline JavaScript found in ${file}`,
            'Inline scripts increase XSS attack surface',
            'Move JavaScript to external files and implement CSP',
            [file], 'CWE-79');
        }

        // Check for missing CSP
        if (!content.includes('Content-Security-Policy')) {
          this.addFinding('MEDIUM', 'Client-Side Security', 'Missing Content Security Policy',
            `No CSP header detected in ${file}`,
            'Lack of CSP protection against XSS and injection attacks',
            'Implement strict Content Security Policy',
            [file], 'CWE-79');
        }

        // Check for external resource loading
        if (content.includes('http://') && !content.includes('https://')) {
          this.addFinding('MEDIUM', 'Client-Side Security', 'Insecure Resource Loading',
            `HTTP resources loaded in ${file}`,
            'Mixed content vulnerabilities and MITM attacks',
            'Use HTTPS for all external resources',
            [file], 'CWE-319');
        }
      }
    });
  }

  async analyzeDependencySecurity() {
    console.log('📦 Analyzing Dependency Security...');
    console.log('─'.repeat(50));

    if (fs.existsSync('package.json')) {
      const packageContent = fs.readFileSync('package.json', 'utf8');
      const packageJson = JSON.parse(packageContent);
      
      // Check for known vulnerable packages (simplified)
      const knownVulnerable = [
        'lodash@4.17.15', 'minimist@1.2.0', 'handlebars@4.0.12',
        'serialize-javascript@2.1.2', 'acorn@6.4.0'
      ];
      
      if (packageJson.dependencies) {
        Object.entries(packageJson.dependencies).forEach(([pkg, version]) => {
          knownVulnerable.forEach(vuln => {
            const [vulnPkg, vulnVersion] = vuln.split('@');
            if (pkg === vulnPkg && version.includes(vulnVersion)) {
              this.addFinding('HIGH', 'Dependencies', 'Known Vulnerable Dependency',
                `Potentially vulnerable package: ${pkg}@${version}`,
                'Known security vulnerabilities in dependencies',
                'Update to latest secure version or find alternative',
                ['package.json'], 'CWE-1104');
            }
          });
        });
      }

      // Check for excessive permissions in package.json
      if (packageJson.scripts && packageJson.scripts.postinstall) {
        this.addFinding('MEDIUM', 'Dependencies', 'Post-install Script Present',
          'Package.json contains post-install script',
          'Post-install scripts can execute arbitrary code',
          'Review post-install script for security implications',
          ['package.json'], 'CWE-506');
      }
    }
  }

  async analyzeLoggingSecurity() {
    console.log('📊 Analyzing Logging Security...');
    console.log('─'.repeat(50));

    try {
      const loggerContent = fs.readFileSync('utils/logger.js', 'utf8');
      
      // Check for proper log sanitization
      if (!loggerContent.includes('sanitize') && loggerContent.includes('user input')) {
        this.addFinding('MEDIUM', 'Logging', 'Potential Log Injection',
          'Logger may not sanitize user input before logging',
          'Log injection attacks could corrupt log data',
          'Sanitize user input before logging',
          ['utils/logger.js'], 'CWE-117');
      }

      // Check for sensitive data logging
      if (loggerContent.includes('password') || loggerContent.includes('token')) {
        this.addFinding('HIGH', 'Logging', 'Sensitive Data in Logs',
          'Logger may record sensitive information',
          'Sensitive data exposure in log files',
          'Exclude sensitive data from logging',
          ['utils/logger.js'], 'CWE-532');
      }

    } catch (error) {
      this.addFinding('LOW', 'Logging', 'Missing Logging Framework',
        'Cannot find logging framework implementation',
        'Security events may not be properly recorded',
        'Implement comprehensive logging framework',
        ['utils/logger.js']);
    }
  }

  generateReport() {
    const totalFindings = this.findings.length;
    const riskScore = (this.criticalCount * 10) + (this.highCount * 7) + (this.mediumCount * 4) + (this.lowCount * 1);
    
    let riskLevel = 'LOW';
    if (riskScore >= 50) riskLevel = 'CRITICAL';
    else if (riskScore >= 30) riskLevel = 'HIGH';
    else if (riskScore >= 15) riskLevel = 'MEDIUM';

    const report = {
      summary: {
        timestamp: new Date().toISOString(),
        totalFindings,
        riskScore,
        riskLevel,
        breakdown: {
          critical: this.criticalCount,
          high: this.highCount,
          medium: this.mediumCount,
          low: this.lowCount,
          informational: this.infoCount
        }
      },
      findings: this.findings,
      recommendations: this.generateRecommendations(),
      compliance: this.assessCompliance()
    };

    fs.writeFileSync('comprehensive-security-assessment.json', JSON.stringify(report, null, 2));

    console.log('\n📊 COMPREHENSIVE SECURITY ASSESSMENT SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Total Findings: ${totalFindings}`);
    console.log(`Critical: ${this.criticalCount} | High: ${this.highCount} | Medium: ${this.mediumCount} | Low: ${this.lowCount} | Info: ${this.infoCount}`);
    console.log(`Risk Score: ${riskScore} (${riskLevel})`);
    console.log('\n💾 Detailed report saved to: comprehensive-security-assessment.json');

    return report;
  }

  generateRecommendations() {
    const recommendations = [
      'Immediate: Address all CRITICAL and HIGH severity findings',
      'Implement comprehensive input validation and sanitization',
      'Enable security headers with Helmet.js middleware',
      'Configure proper rate limiting for all endpoints',
      'Implement secure session management',
      'Use environment variables for all secrets and configuration',
      'Enable comprehensive security logging and monitoring',
      'Regular security audits and dependency updates',
      'Implement proper error handling without information disclosure',
      'Configure Content Security Policy for client-side protection',
      'Use HTTPS for all communications',
      'Implement proper file upload security controls'
    ];

    return recommendations;
  }

  assessCompliance() {
    const compliance = {
      'OWASP Top 10 2021': {
        'A01:2021 - Broken Access Control': this.findings.filter(f => f.category.includes('Authorization')).length === 0 ? 'PASS' : 'FAIL',
        'A02:2021 - Cryptographic Failures': this.findings.filter(f => f.category.includes('Cryptography')).length === 0 ? 'PASS' : 'FAIL',
        'A03:2021 - Injection': this.findings.filter(f => f.cwe === 'CWE-79' || f.cwe === 'CWE-943').length === 0 ? 'PASS' : 'FAIL',
        'A04:2021 - Insecure Design': this.findings.filter(f => f.category.includes('Design')).length === 0 ? 'PASS' : 'FAIL',
        'A05:2021 - Security Misconfiguration': this.findings.filter(f => f.category.includes('Configuration')).length === 0 ? 'PASS' : 'FAIL',
        'A06:2021 - Vulnerable Components': this.findings.filter(f => f.category.includes('Dependencies')).length === 0 ? 'PASS' : 'FAIL',
        'A07:2021 - Identity/Auth Failures': this.findings.filter(f => f.category.includes('Authentication')).length === 0 ? 'PASS' : 'FAIL',
        'A08:2021 - Software/Data Integrity': this.findings.filter(f => f.category.includes('Integrity')).length === 0 ? 'PASS' : 'FAIL',
        'A09:2021 - Logging/Monitoring': this.findings.filter(f => f.category.includes('Logging')).length === 0 ? 'PASS' : 'FAIL',
        'A10:2021 - Server-Side Request Forgery': this.findings.filter(f => f.cwe === 'CWE-918').length === 0 ? 'PASS' : 'FAIL'
      },
      'GDPR Compliance': {
        'Data Protection': this.findings.filter(f => f.category.includes('Data')).length === 0 ? 'PASS' : 'FAIL',
        'Consent Management': 'UNKNOWN',
        'Data Breach Notification': this.findings.filter(f => f.category.includes('Logging')).length === 0 ? 'PASS' : 'FAIL'
      },
      'ISO 27001': {
        'Access Control': this.findings.filter(f => f.category.includes('Authentication')).length === 0 ? 'PASS' : 'FAIL',
        'Cryptography': this.findings.filter(f => f.category.includes('Cryptography')).length === 0 ? 'PASS' : 'FAIL',
        'Incident Management': this.findings.filter(f => f.category.includes('Logging')).length === 0 ? 'PASS' : 'FAIL'
      }
    };

    return compliance;
  }
}

async function runSecurityAssessment() {
  const assessment = new SecurityAssessment();
  await assessment.analyzeCodebase();
  return assessment.generateReport();
}

module.exports = SecurityAssessment;

if (require.main === module) {
  runSecurityAssessment().catch(console.error);
}
