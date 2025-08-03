#!/usr/bin/env node

/**
 * Security Risk Assessment and Vulnerability Analysis Tool
 * Comprehensive evaluation of Cow Social Network security posture
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SecurityRiskAssessment {
  constructor() {
    this.findings = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      informational: []
    };
    this.scores = {
      authentication: 0,
      authorization: 0,
      dataProtection: 0,
      inputValidation: 0,
      sessionManagement: 0,
      errorHandling: 0,
      cryptography: 0,
      infrastructure: 0
    };
  }

  log(severity, title, description, recommendation, file = '', line = '') {
    const finding = {
      severity,
      title,
      description,
      recommendation,
      file,
      line,
      timestamp: new Date().toISOString()
    };
    
    this.findings[severity].push(finding);
    console.log(`[${severity.toUpperCase()}] ${title}`);
    console.log(`  Description: ${description}`);
    if (file) console.log(`  File: ${file}${line ? `:${line}` : ''}`);
    console.log(`  Recommendation: ${recommendation}\n`);
  }

  async analyzeFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        return;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      console.log(`\n🔍 Analyzing: ${filePath}`);
      
      // Authentication Analysis
      this.analyzeAuthentication(content, filePath, lines);
      
      // Authorization Analysis
      this.analyzeAuthorization(content, filePath, lines);
      
      // Data Protection Analysis
      this.analyzeDataProtection(content, filePath, lines);
      
      // Input Validation Analysis
      this.analyzeInputValidation(content, filePath, lines);
      
      // Session Management Analysis
      this.analyzeSessionManagement(content, filePath, lines);
      
      // Error Handling Analysis
      this.analyzeErrorHandling(content, filePath, lines);
      
      // Cryptography Analysis
      this.analyzeCryptography(content, filePath, lines);
      
      // Infrastructure Analysis
      this.analyzeInfrastructure(content, filePath, lines);
      
    } catch (error) {
      this.log('medium', 'File Analysis Error', 
        `Failed to analyze ${filePath}: ${error.message}`,
        'Ensure file is accessible and properly formatted');
    }
  }

  analyzeAuthentication(content, filePath, lines) {
    let score = 0;
    
    // Check for password hashing
    if (content.includes('bcrypt.hash') || content.includes('bcrypt.compare')) {
      score += 20;
    } else if (content.includes('password') && !content.includes('bcrypt')) {
      this.log('critical', 'Weak Password Storage',
        'Passwords may not be properly hashed using secure algorithms',
        'Use bcrypt with at least 12 salt rounds for password hashing',
        filePath);
    }
    
    // Check for JWT implementation
    if (content.includes('jwt.sign') && content.includes('jwt.verify')) {
      score += 15;
      
      // Check for JWT secret hardcoding
      if (content.includes('JWT_SECRET') && content.includes('=')) {
        const secretMatch = content.match(/JWT_SECRET\s*=\s*['"`]([^'"`]+)['"`]/);
        if (secretMatch && secretMatch[1].length < 32) {
          this.log('high', 'Weak JWT Secret',
            'JWT secret is too short or hardcoded',
            'Use a cryptographically secure secret of at least 32 characters from environment variables',
            filePath);
        }
      }
    } else {
      this.log('high', 'Missing JWT Implementation',
        'No proper JWT token implementation detected',
        'Implement JWT for secure authentication tokens',
        filePath);
    }
    
    // Check for rate limiting
    if (content.includes('rate') && (content.includes('limit') || content.includes('429'))) {
      score += 15;
    } else {
      this.log('medium', 'Missing Rate Limiting',
        'No rate limiting detected for authentication endpoints',
        'Implement rate limiting to prevent brute force attacks',
        filePath);
    }
    
    // Check for account lockout
    if (content.includes('lockout') || content.includes('failed') && content.includes('attempt')) {
      score += 15;
    } else {
      this.log('medium', 'Missing Account Lockout',
        'No account lockout mechanism detected',
        'Implement account lockout after multiple failed login attempts',
        filePath);
    }
    
    // Check for multi-factor authentication
    if (content.includes('2fa') || content.includes('mfa') || content.includes('totp')) {
      score += 10;
    } else {
      this.log('informational', 'Missing Multi-Factor Authentication',
        'No multi-factor authentication implementation detected',
        'Consider implementing 2FA for enhanced security',
        filePath);
    }
    
    this.scores.authentication = Math.max(this.scores.authentication, score);
  }

  analyzeAuthorization(content, filePath, lines) {
    let score = 0;
    
    // Check for role-based access control
    if (content.includes('role') && (content.includes('admin') || content.includes('user'))) {
      score += 20;
    } else {
      this.log('medium', 'Missing Role-Based Access Control',
        'No role-based authorization system detected',
        'Implement proper role-based access control (RBAC)',
        filePath);
    }
    
    // Check for middleware protection
    if (content.includes('middleware') || content.includes('verifyToken') || content.includes('authenticate')) {
      score += 15;
    }
    
    // Check for endpoint protection
    const protectedEndpoints = (content.match(/app\.(get|post|put|delete)/g) || []).length;
    const middlewareUsage = (content.match(/,\s*(auth|verify|check)/g) || []).length;
    
    if (protectedEndpoints > 0 && middlewareUsage < protectedEndpoints * 0.5) {
      this.log('high', 'Unprotected API Endpoints',
        'Some API endpoints may lack proper authorization checks',
        'Ensure all sensitive endpoints have proper authentication middleware',
        filePath);
    } else {
      score += 15;
    }
    
    this.scores.authorization = Math.max(this.scores.authorization, score);
  }

  analyzeDataProtection(content, filePath, lines) {
    let score = 0;
    
    // Check for HTTPS enforcement
    if (content.includes('https') || content.includes('ssl') || content.includes('tls')) {
      score += 15;
    } else {
      this.log('high', 'Missing HTTPS Enforcement',
        'No HTTPS/TLS implementation detected',
        'Enforce HTTPS for all communications',
        filePath);
    }
    
    // Check for data encryption
    if (content.includes('encrypt') || content.includes('crypto')) {
      score += 10;
    }
    
    // Check for sensitive data in logs
    lines.forEach((line, index) => {
      if (line.includes('console.log') || line.includes('console.error')) {
        if (line.includes('password') || line.includes('token') || line.includes('secret')) {
          this.log('medium', 'Sensitive Data in Logs',
            'Potential logging of sensitive information detected',
            'Remove or mask sensitive data from log outputs',
            filePath, index + 1);
        }
      }
    });
    
    // Check for database security
    if (content.includes('mongodb://') && !content.includes('ssl=true')) {
      this.log('medium', 'Unencrypted Database Connection',
        'Database connection may not be encrypted',
        'Use encrypted database connections with SSL/TLS',
        filePath);
    } else {
      score += 10;
    }
    
    // Check for data validation
    if (content.includes('validator') || content.includes('joi') || content.includes('yup')) {
      score += 15;
    }
    
    this.scores.dataProtection = Math.max(this.scores.dataProtection, score);
  }

  analyzeInputValidation(content, filePath, lines) {
    let score = 0;
    
    // Check for XSS protection
    if (content.includes('xss') || content.includes('sanitize') || content.includes('escape')) {
      score += 20;
    } else {
      this.log('high', 'Missing XSS Protection',
        'No XSS protection mechanisms detected',
        'Implement input sanitization and output encoding',
        filePath);
    }
    
    // Check for SQL injection protection
    if (content.includes('parameterized') || content.includes('prepared') || 
        (content.includes('mongoose') && !content.includes('$where'))) {
      score += 20;
    } else if (content.includes('SELECT') || content.includes('INSERT') || content.includes('UPDATE')) {
      this.log('critical', 'Potential SQL Injection',
        'Raw SQL queries detected without proper parameterization',
        'Use parameterized queries or ORM to prevent SQL injection',
        filePath);
    }
    
    // Check for input length limits
    if (content.includes('length') && (content.includes('max') || content.includes('limit'))) {
      score += 15;
    } else {
      this.log('medium', 'Missing Input Length Validation',
        'No input length restrictions detected',
        'Implement proper input length validation',
        filePath);
    }
    
    // Check for file upload security
    if (content.includes('multer') || content.includes('upload')) {
      if (content.includes('fileFilter') && content.includes('limits')) {
        score += 15;
      } else {
        this.log('high', 'Insecure File Upload',
          'File upload functionality lacks proper security controls',
          'Implement file type validation, size limits, and secure storage',
          filePath);
      }
    }
    
    this.scores.inputValidation = Math.max(this.scores.inputValidation, score);
  }

  analyzeSessionManagement(content, filePath, lines) {
    let score = 0;
    
    // Check for secure session configuration
    if (content.includes('session') && content.includes('secure')) {
      score += 15;
    }
    
    // Check for session timeout
    if (content.includes('maxAge') || content.includes('expires')) {
      score += 10;
    } else {
      this.log('medium', 'Missing Session Timeout',
        'No session timeout configuration detected',
        'Implement proper session timeout mechanisms',
        filePath);
    }
    
    // Check for session regeneration
    if (content.includes('regenerate') || content.includes('destroy')) {
      score += 10;
    }
    
    // Check for CSRF protection
    if (content.includes('csrf') || content.includes('csurf')) {
      score += 15;
    } else {
      this.log('medium', 'Missing CSRF Protection',
        'No CSRF protection detected',
        'Implement CSRF tokens for state-changing operations',
        filePath);
    }
    
    this.scores.sessionManagement = Math.max(this.scores.sessionManagement, score);
  }

  analyzeErrorHandling(content, filePath, lines) {
    let score = 0;
    
    // Check for generic error messages
    if (content.includes('Internal server error') || content.includes('error:')) {
      score += 10;
    }
    
    // Check for stack trace exposure
    lines.forEach((line, index) => {
      if (line.includes('error.stack') || line.includes('err.stack')) {
        this.log('medium', 'Stack Trace Exposure',
          'Error stack traces may be exposed to users',
          'Log detailed errors server-side but return generic messages to users',
          filePath, index + 1);
      }
    });
    
    // Check for try-catch blocks
    const tryBlocks = (content.match(/try\s*{/g) || []).length;
    const catchBlocks = (content.match(/catch\s*\(/g) || []).length;
    
    if (tryBlocks === catchBlocks && tryBlocks > 0) {
      score += 15;
    } else if (tryBlocks > 0) {
      this.log('low', 'Incomplete Error Handling',
        'Some try blocks may lack proper catch handlers',
        'Ensure all try blocks have corresponding catch handlers',
        filePath);
    }
    
    this.scores.errorHandling = Math.max(this.scores.errorHandling, score);
  }

  analyzeCryptography(content, filePath, lines) {
    let score = 0;
    
    // Check for weak encryption
    if (content.includes('md5') || content.includes('sha1')) {
      this.log('high', 'Weak Cryptographic Algorithms',
        'Use of weak cryptographic algorithms detected',
        'Use SHA-256 or stronger algorithms for hashing',
        filePath);
    }
    
    // Check for proper random generation
    if (content.includes('crypto.randomBytes') || content.includes('crypto.randomUUID')) {
      score += 15;
    } else if (content.includes('Math.random')) {
      this.log('medium', 'Weak Random Number Generation',
        'Use of Math.random() for security-sensitive operations',
        'Use crypto.randomBytes() for cryptographically secure random numbers',
        filePath);
    }
    
    // Check for key management
    if (content.includes('process.env') && (content.includes('KEY') || content.includes('SECRET'))) {
      score += 15;
    } else if (content.includes('SECRET') || content.includes('KEY')) {
      this.log('high', 'Hardcoded Secrets',
        'Cryptographic keys or secrets may be hardcoded',
        'Store secrets in environment variables or secure key management systems',
        filePath);
    }
    
    this.scores.cryptography = Math.max(this.scores.cryptography, score);
  }

  analyzeInfrastructure(content, filePath, lines) {
    let score = 0;
    
    // Check for security headers
    if (content.includes('helmet') || content.includes('X-Frame-Options')) {
      score += 20;
    } else {
      this.log('medium', 'Missing Security Headers',
        'No security headers implementation detected',
        'Implement security headers using Helmet.js or manually',
        filePath);
    }
    
    // Check for CORS configuration
    if (content.includes('cors') || content.includes('Access-Control')) {
      score += 10;
    }
    
    // Check for dependency versions
    if (filePath.includes('package.json')) {
      try {
        const packageData = JSON.parse(content);
        if (packageData.dependencies) {
          // Check for known vulnerable packages
          const vulnerablePackages = ['express', 'mongoose', 'bcrypt', 'jsonwebtoken'];
          vulnerablePackages.forEach(pkg => {
            if (packageData.dependencies[pkg]) {
              this.log('informational', 'Dependency Security Check',
                `Package ${pkg} found - ensure it's updated to latest secure version`,
                'Regularly audit and update dependencies using npm audit',
                filePath);
            }
          });
        }
      } catch (e) {
        // Invalid JSON
      }
    }
    
    this.scores.infrastructure = Math.max(this.scores.infrastructure, score);
  }

  generateRiskMatrix() {
    console.log('\n📊 SECURITY RISK MATRIX');
    console.log('═'.repeat(60));
    
    const totalFindings = Object.values(this.findings).reduce((sum, arr) => sum + arr.length, 0);
    
    console.log(`Total Security Findings: ${totalFindings}`);
    console.log(`Critical: ${this.findings.critical.length}`);
    console.log(`High: ${this.findings.high.length}`);
    console.log(`Medium: ${this.findings.medium.length}`);
    console.log(`Low: ${this.findings.low.length}`);
    console.log(`Informational: ${this.findings.informational.length}`);
    
    // Calculate overall risk score
    const riskScore = (
      this.findings.critical.length * 10 +
      this.findings.high.length * 7 +
      this.findings.medium.length * 4 +
      this.findings.low.length * 2 +
      this.findings.informational.length * 1
    );
    
    console.log(`\nOverall Risk Score: ${riskScore}`);
    
    let riskLevel = 'LOW';
    if (riskScore > 50) riskLevel = 'CRITICAL';
    else if (riskScore > 30) riskLevel = 'HIGH';
    else if (riskScore > 15) riskLevel = 'MEDIUM';
    
    console.log(`Risk Level: ${riskLevel}`);
    
    return { riskScore, riskLevel, totalFindings };
  }

  generateSecurityScorecard() {
    console.log('\n🎯 SECURITY SCORECARD');
    console.log('═'.repeat(60));
    
    Object.entries(this.scores).forEach(([category, score]) => {
      const percentage = Math.min(100, score);
      const stars = '★'.repeat(Math.floor(percentage / 20)) + '☆'.repeat(5 - Math.floor(percentage / 20));
      console.log(`${category.padEnd(20)}: ${percentage.toString().padStart(3)}% ${stars}`);
    });
    
    const averageScore = Object.values(this.scores).reduce((sum, score) => sum + score, 0) / Object.keys(this.scores).length;
    console.log(`${'OVERALL'.padEnd(20)}: ${Math.round(averageScore).toString().padStart(3)}%`);
    
    return Math.round(averageScore);
  }

  generateComplianceReport() {
    console.log('\n📋 COMPLIANCE ASSESSMENT');
    console.log('═'.repeat(60));
    
    const compliance = {
      'OWASP Top 10': this.assessOWASP(),
      'GDPR Readiness': this.assessGDPR(),
      'PCI DSS': this.assessPCIDSS(),
      'ISO 27001': this.assessISO27001()
    };
    
    Object.entries(compliance).forEach(([standard, status]) => {
      console.log(`${standard.padEnd(20)}: ${status}`);
    });
    
    return compliance;
  }

  assessOWASP() {
    const owaspIssues = [
      this.findings.critical.filter(f => f.title.includes('Injection')).length > 0,
      this.findings.high.filter(f => f.title.includes('Authentication')).length > 0,
      this.findings.medium.filter(f => f.title.includes('XSS')).length > 0,
      this.findings.medium.filter(f => f.title.includes('Access Control')).length > 0
    ];
    
    const compliantPercent = ((4 - owaspIssues.filter(Boolean).length) / 4) * 100;
    return `${Math.round(compliantPercent)}% Compliant`;
  }

  assessGDPR() {
    const hasEncryption = this.scores.cryptography > 20;
    const hasDataProtection = this.scores.dataProtection > 30;
    const hasAccessControl = this.scores.authorization > 20;
    
    const compliantPercent = ([hasEncryption, hasDataProtection, hasAccessControl].filter(Boolean).length / 3) * 100;
    return `${Math.round(compliantPercent)}% Compliant`;
  }

  assessPCIDSS() {
    const hasEncryption = this.scores.cryptography > 25;
    const hasAccessControl = this.scores.authorization > 25;
    const hasNetworkSecurity = this.scores.infrastructure > 25;
    
    const compliantPercent = ([hasEncryption, hasAccessControl, hasNetworkSecurity].filter(Boolean).length / 3) * 100;
    return `${Math.round(compliantPercent)}% Compliant`;
  }

  assessISO27001() {
    const avgScore = Object.values(this.scores).reduce((sum, score) => sum + score, 0) / Object.keys(this.scores).length;
    return `${Math.round(avgScore)}% Compliant`;
  }

  async generateReport() {
    const timestamp = new Date().toISOString();
    const riskMatrix = this.generateRiskMatrix();
    const securityScore = this.generateSecurityScorecard();
    const compliance = this.generateComplianceReport();
    
    const report = {
      timestamp,
      projectName: 'Cow Social Network',
      assessment: {
        riskScore: riskMatrix.riskScore,
        riskLevel: riskMatrix.riskLevel,
        securityScore,
        totalFindings: riskMatrix.totalFindings
      },
      findings: this.findings,
      scores: this.scores,
      compliance,
      recommendations: this.generateRecommendations()
    };
    
    // Save detailed report
    fs.writeFileSync('security-risk-assessment.json', JSON.stringify(report, null, 2));
    console.log('\n💾 Detailed report saved to: security-risk-assessment.json');
    
    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.findings.critical.length > 0) {
      recommendations.push('URGENT: Address all critical security vulnerabilities immediately');
    }
    
    if (this.scores.authentication < 50) {
      recommendations.push('Strengthen authentication mechanisms with MFA and rate limiting');
    }
    
    if (this.scores.inputValidation < 50) {
      recommendations.push('Implement comprehensive input validation and sanitization');
    }
    
    if (this.scores.cryptography < 50) {
      recommendations.push('Review and strengthen cryptographic implementations');
    }
    
    recommendations.push('Conduct regular security audits and penetration testing');
    recommendations.push('Implement security monitoring and incident response procedures');
    recommendations.push('Provide security training for development team');
    
    return recommendations;
  }
}

// Main execution
async function runSecurityAssessment() {
  console.log('🔒 COW SOCIAL NETWORK - SECURITY RISK ASSESSMENT');
  console.log('═'.repeat(60));
  console.log('Starting comprehensive security analysis...\n');
  
  const assessment = new SecurityRiskAssessment();
  
  // Files to analyze
  const filesToAnalyze = [
    'server.js',
    'perfect-100-security-server.js',
    'ultimate-security-server.js',
    'package.json',
    'middleware/auth.js',
    'middleware/security.js',
    'models/User.js',
    'config/database.js'
  ];
  
  // Analyze each file
  for (const file of filesToAnalyze) {
    await assessment.analyzeFile(file);
  }
  
  // Generate comprehensive report
  const report = await assessment.generateReport();
  
  console.log('\n🎉 Security Risk Assessment Complete!');
  console.log(`Overall Security Score: ${report.assessment.securityScore}%`);
  console.log(`Risk Level: ${report.assessment.riskLevel}`);
  
  return report;
}

// Export for use as module
module.exports = SecurityRiskAssessment;

// Run if executed directly
if (require.main === module) {
  runSecurityAssessment().catch(console.error);
}
