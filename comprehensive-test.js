#!/usr/bin/env node

/**
 * Comprehensive Security and Performance Test Suite
 * Tests all aspects of the system after security fixes
 */

const SecurityTester = require('./security-stress-test');
const CodeAnalyzer = require('./code-analyzer');
const PerformanceTester = require('./performance-test');
const axios = require('axios');

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

class ComprehensiveTestSuite {
  constructor() {
    this.results = {
      security: {},
      codeQuality: {},
      performance: {},
      overall: {}
    };
  }

  async checkServerHealth() {
    log('blue', '🔍 Checking Server Health...');
    
    try {
      const response = await axios.get('http://localhost:3000/', {
        timeout: 5000,
        validateStatus: () => true
      });
      
      if (response.status === 200) {
        log('green', '✅ Server is responding normally');
        return true;
      } else {
        log('yellow', `⚠️ Server responding with status: ${response.status}`);
        return false;
      }
    } catch (error) {
      log('red', `❌ Server health check failed: ${error.message}`);
      return false;
    }
  }

  async runSecurityTests() {
    log('cyan', '\n🔐 Running Security Test Suite');
    log('cyan', '==============================');
    
    const securityTester = new SecurityTester();
    await securityTester.runAllTests();
    
    this.results.security = {
      passed: securityTester.results.passed,
      failed: securityTester.results.failed,
      total: securityTester.results.passed + securityTester.results.failed,
      score: ((securityTester.results.passed / (securityTester.results.passed + securityTester.results.failed)) * 100).toFixed(1)
    };
  }

  async runCodeQualityTests() {
    log('cyan', '\n📊 Running Code Quality Analysis');
    log('cyan', '================================');
    
    const codeAnalyzer = new CodeAnalyzer();
    await codeAnalyzer.analyzeProject();
    
    const criticalIssues = codeAnalyzer.issues.critical.length;
    const highIssues = codeAnalyzer.issues.high.length;
    const mediumIssues = codeAnalyzer.issues.medium.length;
    const lowIssues = codeAnalyzer.issues.low.length;
    
    // Calculate quality score
    const totalWeight = criticalIssues * 10 + highIssues * 5 + mediumIssues * 2 + lowIssues * 1;
    const qualityScore = Math.max(0, 100 - totalWeight);
    
    this.results.codeQuality = {
      critical: criticalIssues,
      high: highIssues,
      medium: mediumIssues,
      low: lowIssues,
      total: criticalIssues + highIssues + mediumIssues + lowIssues,
      score: qualityScore,
      filesAnalyzed: codeAnalyzer.stats.filesAnalyzed,
      linesOfCode: codeAnalyzer.stats.linesOfCode
    };
  }

  async runPerformanceTests() {
    log('cyan', '\n🚀 Running Performance Test Suite');
    log('cyan', '=================================');
    
    const performanceTester = new PerformanceTester();
    await performanceTester.runPerformanceTests();
    
    const avgResponseTime = performanceTester.results.length > 0 
      ? performanceTester.results.reduce((sum, result) => sum + result.avgTime, 0) / performanceTester.results.length
      : 0;
    
    const avgSuccessRate = performanceTester.results.length > 0
      ? performanceTester.results.reduce((sum, result) => sum + parseFloat(result.successRate), 0) / performanceTester.results.length
      : 0;
    
    // Calculate performance score
    let performanceScore = 100;
    if (avgResponseTime > 2000) performanceScore -= 30;
    else if (avgResponseTime > 1000) performanceScore -= 15;
    else if (avgResponseTime > 500) performanceScore -= 5;
    
    if (avgSuccessRate < 95) performanceScore -= 20;
    else if (avgSuccessRate < 99) performanceScore -= 10;
    
    this.results.performance = {
      avgResponseTime: Math.round(avgResponseTime),
      avgSuccessRate: avgSuccessRate.toFixed(1),
      score: performanceScore,
      testsRun: performanceTester.results.length
    };
  }

  async testDatabaseConnectivity() {
    log('blue', '🗄️ Testing Database Connectivity...');
    
    try {
      const response = await axios.post('http://localhost:3000/api/auth/login', {
        email: 'test@example.com',
        password: 'wrongpassword'
      }, { 
        timeout: 5000,
        validateStatus: () => true 
      });
      
      if (response.status === 400 || response.status === 401) {
        log('green', '✅ Database connectivity confirmed (authentication endpoint working)');
        return true;
      } else {
        log('yellow', `⚠️ Unexpected response from auth endpoint: ${response.status}`);
        return false;
      }
    } catch (error) {
      log('red', `❌ Database connectivity test failed: ${error.message}`);
      return false;
    }
  }

  calculateOverallScore() {
    const securityWeight = 0.4;
    const qualityWeight = 0.3;
    const performanceWeight = 0.3;
    
    const securityScore = parseFloat(this.results.security.score) || 0;
    const qualityScore = this.results.codeQuality.score || 0;
    const performanceScore = this.results.performance.score || 0;
    
    const overallScore = (
      securityScore * securityWeight +
      qualityScore * qualityWeight +
      performanceScore * performanceWeight
    ).toFixed(1);
    
    this.results.overall = {
      score: overallScore,
      security: securityScore,
      quality: qualityScore,
      performance: performanceScore
    };
  }

  generateComprehensiveReport() {
    log('cyan', '\n📋 Comprehensive Test Report');
    log('cyan', '============================\n');

    // Overall Score
    const overallScore = parseFloat(this.results.overall.score);
    log('white', '🏆 OVERALL SYSTEM HEALTH:');
    if (overallScore >= 90) {
      log('green', `   ✅ EXCELLENT: ${overallScore}/100`);
    } else if (overallScore >= 80) {
      log('yellow', `   🥈 GOOD: ${overallScore}/100`);
    } else if (overallScore >= 70) {
      log('yellow', `   🥉 FAIR: ${overallScore}/100`);
    } else {
      log('red', `   ⚠️ NEEDS IMPROVEMENT: ${overallScore}/100`);
    }

    // Security Results
    log('\n');
    log('white', '🔐 SECURITY TEST RESULTS:');
    log('white', `   Score: ${this.results.security.score}%`);
    log('white', `   Passed: ${this.results.security.passed}/${this.results.security.total} tests`);
    log('white', `   Failed: ${this.results.security.failed} tests`);

    // Code Quality Results
    log('\n');
    log('white', '📊 CODE QUALITY ANALYSIS:');
    log('white', `   Score: ${this.results.codeQuality.score}/100`);
    log('white', `   Files Analyzed: ${this.results.codeQuality.filesAnalyzed}`);
    log('white', `   Lines of Code: ${this.results.codeQuality.linesOfCode}`);
    log('white', `   Issues Found: ${this.results.codeQuality.total}`);
    if (this.results.codeQuality.critical > 0) {
      log('red', `     🔴 Critical: ${this.results.codeQuality.critical}`);
    }
    if (this.results.codeQuality.high > 0) {
      log('yellow', `     🟠 High: ${this.results.codeQuality.high}`);
    }
    if (this.results.codeQuality.medium > 0) {
      log('yellow', `     🟡 Medium: ${this.results.codeQuality.medium}`);
    }
    if (this.results.codeQuality.low > 0) {
      log('blue', `     🔵 Low: ${this.results.codeQuality.low}`);
    }

    // Performance Results
    log('\n');
    log('white', '🚀 PERFORMANCE TEST RESULTS:');
    log('white', `   Score: ${this.results.performance.score}/100`);
    log('white', `   Average Response Time: ${this.results.performance.avgResponseTime}ms`);
    log('white', `   Average Success Rate: ${this.results.performance.avgSuccessRate}%`);
    log('white', `   Tests Completed: ${this.results.performance.testsRun}`);

    // Recommendations
    log('\n');
    log('cyan', '💡 RECOMMENDATIONS:');
    
    if (this.results.security.failed > 0) {
      log('red', '   🚨 CRITICAL: Fix failing security tests immediately');
      log('red', '      • Implement proper rate limiting');
      log('red', '      • Fix account lockout mechanism');
      log('red', '      • Secure file upload validation');
    }
    
    if (this.results.codeQuality.critical > 0 || this.results.codeQuality.high > 0) {
      log('yellow', '   ⚠️ HIGH PRIORITY: Address critical and high-severity code issues');
      log('yellow', '      • Fix hardcoded credentials');
      log('yellow', '      • Implement proper error handling');
      log('yellow', '      • Remove debug code from production');
    }
    
    if (this.results.performance.avgResponseTime > 1000) {
      log('yellow', '   🐌 PERFORMANCE: Optimize slow endpoints');
      log('yellow', '      • Review database queries');
      log('yellow', '      • Implement caching strategy');
      log('yellow', '      • Consider load balancing');
    }

    // Action Items
    log('\n');
    log('cyan', '📝 ACTION ITEMS:');
    log('white', '   1. Integrate security middleware fixes from security-fixes.js');
    log('white', '   2. Update User model with account lockout mechanism');
    log('white', '   3. Replace JWT validation with enhanced version');
    log('white', '   4. Apply input validation to all API endpoints');
    log('white', '   5. Configure Redis or remove Redis dependency');
    log('white', '   6. Run tests again after implementing fixes');
    log('white', '   7. Set up continuous security and performance monitoring');

    log('\n');
    log('cyan', '============================');
    log('cyan', '📋 Test Suite Complete');
    log('cyan', '============================');
  }

  async runFullTestSuite() {
    log('cyan', '🧪 Starting Comprehensive Test Suite');
    log('cyan', '====================================\n');

    // Check if server is running
    const serverHealthy = await this.checkServerHealth();
    if (!serverHealthy) {
      log('red', '❌ Server is not healthy. Please start the server and try again.');
      process.exit(1);
    }

    // Test database connectivity
    await this.testDatabaseConnectivity();

    // Run all test suites
    await this.runSecurityTests();
    await this.runCodeQualityTests();
    await this.runPerformanceTests();

    // Calculate overall score
    this.calculateOverallScore();

    // Generate comprehensive report
    this.generateComprehensiveReport();
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const testSuite = new ComprehensiveTestSuite();
  testSuite.runFullTestSuite().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = ComprehensiveTestSuite;
