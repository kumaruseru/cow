#!/usr/bin/env node

/**
 * Performance and Load Testing Tool
 * Tests server performance under various load conditions
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

const BASE_URL = 'http://localhost:3000';

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

class PerformanceTester {
  constructor() {
    this.results = [];
  }

  async measureResponseTime(name, requestFunction, iterations = 10) {
    log('blue', `\n📊 Testing: ${name}`);
    
    const times = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < iterations; i++) {
      try {
        const startTime = performance.now();
        const response = await requestFunction();
        const endTime = performance.now();
        
        const responseTime = endTime - startTime;
        times.push(responseTime);
        
        if (response.status < 400) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
        log('red', `   Error in iteration ${i + 1}: ${error.message}`);
      }
    }

    if (times.length === 0) {
      log('red', `❌ All requests failed for ${name}`);
      return;
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const medianTime = times.sort((a, b) => a - b)[Math.floor(times.length / 2)];

    const result = {
      name,
      avgTime: Math.round(avgTime),
      minTime: Math.round(minTime),
      maxTime: Math.round(maxTime),
      medianTime: Math.round(medianTime),
      successCount,
      errorCount,
      successRate: (successCount / iterations * 100).toFixed(1)
    };

    this.results.push(result);

    log('green', `✅ ${name}:`);
    log('white', `   Average: ${result.avgTime}ms`);
    log('white', `   Min: ${result.minTime}ms | Max: ${result.maxTime}ms | Median: ${result.medianTime}ms`);
    log('white', `   Success Rate: ${result.successRate}% (${successCount}/${iterations})`);

    // Performance thresholds
    if (avgTime > 2000) {
      log('red', '   ⚠️ SLOW: Average response time > 2 seconds');
    } else if (avgTime > 1000) {
      log('yellow', '   ⚠️ WARNING: Average response time > 1 second');
    } else {
      log('green', '   ✅ GOOD: Response time acceptable');
    }
  }

  async testConcurrentLoad(endpoint, concurrent = 10, requests = 50) {
    log('blue', `\n🏋️ Concurrent Load Test: ${endpoint}`);
    log('white', `   Concurrent users: ${concurrent}`);
    log('white', `   Total requests: ${requests}`);

    const startTime = performance.now();
    const promises = [];
    
    for (let i = 0; i < requests; i++) {
      const promise = axios.get(`${BASE_URL}${endpoint}`, {
        validateStatus: () => true,
        timeout: 10000
      });
      promises.push(promise);
      
      // Control concurrency
      if (promises.length >= concurrent) {
        await Promise.all(promises.splice(0, concurrent));
      }
    }
    
    // Wait for remaining requests
    if (promises.length > 0) {
      await Promise.all(promises);
    }
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const requestsPerSecond = (requests / (totalTime / 1000)).toFixed(2);
    
    log('green', `✅ Load Test Complete:`);
    log('white', `   Total time: ${Math.round(totalTime)}ms`);
    log('white', `   Requests per second: ${requestsPerSecond}`);
    
    if (requestsPerSecond < 10) {
      log('red', '   ⚠️ LOW THROUGHPUT: < 10 requests/second');
    } else if (requestsPerSecond < 50) {
      log('yellow', '   ⚠️ MODERATE THROUGHPUT: < 50 requests/second');
    } else {
      log('green', '   ✅ GOOD THROUGHPUT: >= 50 requests/second');
    }
  }

  async testMemoryUsage() {
    log('blue', '\n💾 Memory Usage Test');
    
    const initialMemory = process.memoryUsage();
    log('white', `   Initial Memory:`);
    log('white', `     RSS: ${Math.round(initialMemory.rss / 1024 / 1024)}MB`);
    log('white', `     Heap Used: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);
    log('white', `     External: ${Math.round(initialMemory.external / 1024 / 1024)}MB`);

    // Simulate heavy load
    const requests = [];
    for (let i = 0; i < 100; i++) {
      requests.push(
        axios.get(`${BASE_URL}/`, { validateStatus: () => true })
          .catch(() => {}) // Ignore errors for memory test
      );
    }
    
    await Promise.all(requests);
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage();
    log('white', `   Final Memory:`);
    log('white', `     RSS: ${Math.round(finalMemory.rss / 1024 / 1024)}MB`);
    log('white', `     Heap Used: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);
    log('white', `     External: ${Math.round(finalMemory.external / 1024 / 1024)}MB`);
    
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    const percentIncrease = (memoryIncrease / initialMemory.heapUsed * 100).toFixed(1);
    
    log('white', `   Memory Change: ${Math.round(memoryIncrease / 1024 / 1024)}MB (${percentIncrease}%)`);
    
    if (memoryIncrease > 50 * 1024 * 1024) { // 50MB
      log('red', '   ⚠️ MEMORY LEAK: Significant memory increase');
    } else {
      log('green', '   ✅ MEMORY OK: No significant memory increase');
    }
  }

  async runPerformanceTests() {
    log('cyan', '🚀 Starting Performance Tests');
    log('cyan', '=============================\n');

    // Test basic endpoints
    await this.measureResponseTime('Home Page Load', () => 
      axios.get(`${BASE_URL}/`, { validateStatus: () => true }));

    await this.measureResponseTime('Login Page Load', () => 
      axios.get(`${BASE_URL}/login`, { validateStatus: () => true }));

    await this.measureResponseTime('Static File Serving', () => 
      axios.get(`${BASE_URL}/`, { validateStatus: () => true }));

    // Test API endpoints
    await this.measureResponseTime('Login API (Invalid)', () => 
      axios.post(`${BASE_URL}/api/auth/login`, {
        email: 'test@example.com',
        password: 'wrongpassword'
      }, { validateStatus: () => true }));

    await this.measureResponseTime('Registration API', () => 
      axios.post(`${BASE_URL}/api/auth/register`, {
        firstName: 'Test',
        lastName: 'User',
        email: `test.${Date.now()}@example.com`,
        password: 'TestPassword123!'
      }, { validateStatus: () => true }));

    // Concurrent load tests
    await this.testConcurrentLoad('/', 5, 25);
    await this.testConcurrentLoad('/login', 10, 50);

    // Memory usage test
    await this.testMemoryUsage();

    this.generatePerformanceReport();
  }

  generatePerformanceReport() {
    log('cyan', '\n📊 Performance Report Summary');
    log('cyan', '==============================');

    if (this.results.length === 0) {
      log('red', 'No performance data collected');
      return;
    }

    // Calculate overall performance score
    const avgResponseTimes = this.results.map(r => r.avgTime);
    const overallAvgTime = avgResponseTimes.reduce((a, b) => a + b, 0) / avgResponseTimes.length;
    const successRates = this.results.map(r => parseFloat(r.successRate));
    const overallSuccessRate = successRates.reduce((a, b) => a + b, 0) / successRates.length;

    log('white', `\n📈 Overall Performance:`);
    log('white', `   Average Response Time: ${Math.round(overallAvgTime)}ms`);
    log('white', `   Overall Success Rate: ${overallSuccessRate.toFixed(1)}%`);

    // Performance score calculation
    let score = 100;
    if (overallAvgTime > 2000) score -= 30;
    else if (overallAvgTime > 1000) score -= 15;
    else if (overallAvgTime > 500) score -= 5;

    if (overallSuccessRate < 95) score -= 20;
    else if (overallSuccessRate < 99) score -= 10;

    log('cyan', '\n🏆 Performance Score');
    log('cyan', '===================');
    
    if (score >= 90) {
      log('green', `✅ Score: ${score}/100 - EXCELLENT`);
    } else if (score >= 80) {
      log('yellow', `🥈 Score: ${score}/100 - GOOD`);
    } else if (score >= 70) {
      log('yellow', `🥉 Score: ${score}/100 - FAIR`);
    } else {
      log('red', `⚠️ Score: ${score}/100 - NEEDS OPTIMIZATION`);
    }

    // Recommendations
    log('cyan', '\n💡 Recommendations:');
    if (overallAvgTime > 1000) {
      log('yellow', '   • Optimize slow endpoints (>1s response time)');
      log('yellow', '   • Consider implementing caching');
      log('yellow', '   • Review database queries for optimization');
    }
    
    if (overallSuccessRate < 99) {
      log('yellow', '   • Investigate request failures');
      log('yellow', '   • Improve error handling');
    }
    
    log('yellow', '   • Monitor performance in production');
    log('yellow', '   • Set up automated performance testing');
    log('yellow', '   • Consider implementing CDN for static assets');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new PerformanceTester();
  tester.runPerformanceTests().catch(error => {
    console.error('Performance tests failed:', error);
    process.exit(1);
  });
}

module.exports = PerformanceTester;
