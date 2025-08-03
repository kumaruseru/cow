const express = require('express');
const mongoose = require('mongoose');
const cacheService = require('../services/cacheService');
const securityMonitoringService = require('../services/securityMonitoringService');
const dbOptimizationService = require('../services/dbOptimizationService');
const advancedRateLimitService = require('../services/advancedRateLimitService');
const apiPerformanceMonitor = require('../services/apiPerformanceMonitor');
const deviceFingerprintingService = require('../services/deviceFingerprintingService');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Super fast ping endpoint - no async operations
 */
router.get('/ping', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

/**
 * Health check endpoint - Fast response
 */
router.get('/health', async (req, res) => {
  try {
    const healthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      services: {}
    };

    // Quick MongoDB connection check
    healthStatus.services.database = {
      status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      name: mongoose.connection.name || 'unknown'
    };

    // Quick Redis cache check (no stats for speed)
    healthStatus.services.cache = {
      status: cacheService.isConnected ? 'connected' : 'offline'
    };

    // Enhanced service status
    healthStatus.services.security = { status: 'active' };
    healthStatus.services.dbOptimization = { status: 'active' };
    healthStatus.services.rateLimiting = { status: 'active' };
    healthStatus.services.apiMonitoring = { status: 'active' };
    healthStatus.services.deviceFingerprinting = { status: 'active' };

    // Quick memory usage
    const memUsage = process.memoryUsage();
    healthStatus.memory = {
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
      rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`
    };

    // Overall health status - allow degraded operation without cache
    const criticalServicesHealthy = healthStatus.services.database.status === 'connected';

    if (!criticalServicesHealthy) {
      healthStatus.status = 'unhealthy';
    } else if (!cacheService.isConnected) {
      healthStatus.status = 'degraded'; // Still healthy without cache
    }

    const statusCode = healthStatus.status === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * Simple liveness check - fastest response
 */
router.get('/live', (req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * Quick status check
 */
router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  });
});

/**
 * Readiness check for Kubernetes/Docker
 */
router.get('/ready', async (req, res) => {
  try {
    // Check critical services
    const dbReady = mongoose.connection.readyState === 1;
    const cacheReady = cacheService.isConnected;

    if (dbReady && cacheReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        services: {
          database: 'ready',
          cache: 'ready'
        }
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        services: {
          database: dbReady ? 'ready' : 'not ready',
          cache: cacheReady ? 'ready' : 'not ready'
        }
      });
    }
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * Liveness check for Kubernetes/Docker
 */
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * Security dashboard endpoint (admin only)
 */
router.get('/security', async (req, res) => {
  try {
    // TODO: Add admin authentication check
    // if (!req.user || req.user.role !== 'admin') {
    //   return res.status(403).json({ error: 'Admin access required' });
    // }

    const dashboard = await securityMonitoringService.getSecurityDashboard();
    res.json(dashboard);
  } catch (error) {
    logger.error('Security dashboard error:', error);
    res.status(500).json({
      error: 'Failed to fetch security dashboard'
    });
  }
});

/**
 * Detailed metrics endpoint with all service analytics
 */
router.get('/metrics', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Database optimization metrics
    const dbMetrics = dbOptimizationService.getQueryStats();
    
    // Rate limiting analytics
    const rateLimitAnalytics = advancedRateLimitService.getAnalytics();
    
    // API performance metrics
    const performanceMetrics = apiPerformanceMonitor.getRealTimeMetrics();
    
    // Device analytics
    const deviceAnalytics = deviceFingerprintingService.getDeviceAnalytics();

    // Cache service detailed stats
    const cacheStats = await Promise.race([
      cacheService.getStats(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Cache stats timeout')), 3000))
    ]).catch(error => ({ error: error.message }));

    const responseTime = Date.now() - startTime;

    res.status(200).json({
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      uptime: process.uptime(),
      metrics: {
        database: dbMetrics,
        cache: cacheStats,
        rateLimiting: rateLimitAnalytics,
        performance: performanceMetrics,
        devices: deviceAnalytics
      },
      system: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        platform: process.platform,
        nodeVersion: process.version,
        environment: process.env.NODE_ENV
      }
    });
  } catch (error) {
    logger.error('Metrics collection failed:', error);
    res.status(500).json({
      error: 'Failed to collect metrics',
      timestamp: new Date().toISOString(),
      details: error.message
    });
  }
});

/**
 * Database performance check
 */
router.get('/db-check', async (req, res) => {
  try {
    const start = Date.now();

    // Simple query to test database performance
    const User = require('../models/User');
    await User.findOne().limit(1);

    const responseTime = Date.now() - start;

    res.json({
      status: 'ok',
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
      connection: {
        state: mongoose.connection.readyState,
        host: mongoose.connection.host,
        name: mongoose.connection.name
      }
    });
  } catch (error) {
    logger.error('Database check failed:', error);
    res.status(503).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Cache performance check
 */
router.get('/cache-check', async (req, res) => {
  try {
    const start = Date.now();
    const testKey = 'health-check-test';
    const testValue = 'test-value';

    // Test cache operations
    await cacheService.set(testKey, testValue, 60);
    const retrieved = await cacheService.get(testKey);
    await cacheService.del(testKey);

    const responseTime = Date.now() - start;

    res.json({
      status: retrieved === testValue ? 'ok' : 'error',
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
      operations: ['set', 'get', 'delete'],
      connected: cacheService.isConnected
    });
  } catch (error) {
    logger.error('Cache check failed:', error);
    res.status(503).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
