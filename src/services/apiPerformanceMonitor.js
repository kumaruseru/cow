const logger = require('../utils/logger');
const cacheService = require('./cacheService');

class APIPerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: new Map(),
      endpoints: new Map(),
      responseTypes: new Map(),
      slowRequests: [],
      errorRates: new Map()
    };

    this.config = {
      slowRequestThreshold: 1000, // 1 second
      metricsRetentionTime: 24 * 60 * 60 * 1000, // 24 hours
      maxSlowRequestsStored: 100,
      alertThresholds: {
        avgResponseTime: 2000, // 2 seconds
        errorRate: 5, // 5%
        requestSpike: 1000 // requests per minute
      }
    };

    this.startTime = Date.now();
  }

  /**
   * Initialize performance monitoring
   */
  initialize() {
    // Setup periodic cleanup
    setInterval(
      () => {
        this.cleanupOldMetrics();
      },
      60 * 60 * 1000
    ); // Every hour

    // Setup metrics aggregation
    setInterval(
      () => {
        this.aggregateMetrics();
      },
      5 * 60 * 1000
    ); // Every 5 minutes

    logger.info('API Performance Monitor initialized');
  }

  /**
   * Main middleware function
   */
  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      const requestId = this.generateRequestId();

      // Add request ID to request object
      req.requestId = requestId;

      // Store original res.json and res.send to capture response
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);

      let responseBody = null;
      let responseSent = false;

      // Override res.json
      res.json = function (body) {
        if (!responseSent) {
          responseBody = body;
          responseSent = true;
        }
        return originalJson(body);
      };

      // Override res.send
      res.send = function (body) {
        if (!responseSent) {
          responseBody = body;
          responseSent = true;
        }
        return originalSend(body);
      };

      // Capture response completion
      res.on('finish', () => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        this.recordRequest({
          requestId,
          method: req.method,
          path: req.path,
          originalUrl: req.originalUrl,
          statusCode: res.statusCode,
          duration,
          timestamp: startTime,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          contentLength: res.get('Content-Length'),
          userId: req.user?.id,
          responseBody: this.sanitizeResponseBody(responseBody)
        });
      });

      // Capture errors
      res.on('error', error => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        this.recordError({
          requestId,
          method: req.method,
          path: req.path,
          error: error.message,
          duration,
          timestamp: startTime,
          ip: req.ip
        });
      });

      next();
    };
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sanitize response body for logging
   */
  sanitizeResponseBody(body) {
    if (!body) return null;

    try {
      // Convert to string if not already
      let bodyStr = typeof body === 'string' ? body : JSON.stringify(body);

      // Limit size
      if (bodyStr.length > 1000) {
        bodyStr = bodyStr.substring(0, 1000) + '...';
      }

      // Remove sensitive data patterns
      bodyStr = bodyStr.replace(/"password":"[^"]*"/g, '"password":"[REDACTED]"');
      bodyStr = bodyStr.replace(/"token":"[^"]*"/g, '"token":"[REDACTED]"');
      bodyStr = bodyStr.replace(/"secret":"[^"]*"/g, '"secret":"[REDACTED]"');

      return bodyStr;
    } catch (error) {
      return '[Invalid JSON]';
    }
  }

  /**
   * Record request metrics
   */
  recordRequest(requestData) {
    const { method, path, statusCode, duration, timestamp, userId, ip } = requestData;

    // Create endpoint key
    const endpointKey = `${method} ${this.normalizeEndpoint(path)}`;

    // Update request count
    if (!this.metrics.requests.has(timestamp)) {
      this.metrics.requests.set(timestamp, {
        count: 0,
        totalDuration: 0,
        errors: 0
      });
    }

    const requestMetric = this.metrics.requests.get(timestamp);
    requestMetric.count++;
    requestMetric.totalDuration += duration;

    if (statusCode >= 400) {
      requestMetric.errors++;
    }

    // Update endpoint metrics
    if (!this.metrics.endpoints.has(endpointKey)) {
      this.metrics.endpoints.set(endpointKey, {
        count: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        errors: 0,
        statusCodes: new Map(),
        lastAccessed: timestamp
      });
    }

    const endpointMetric = this.metrics.endpoints.get(endpointKey);
    endpointMetric.count++;
    endpointMetric.totalDuration += duration;
    endpointMetric.minDuration = Math.min(endpointMetric.minDuration, duration);
    endpointMetric.maxDuration = Math.max(endpointMetric.maxDuration, duration);
    endpointMetric.lastAccessed = timestamp;

    if (statusCode >= 400) {
      endpointMetric.errors++;
    }

    // Update status code count
    const statusKey = Math.floor(statusCode / 100) * 100;
    endpointMetric.statusCodes.set(statusKey, (endpointMetric.statusCodes.get(statusKey) || 0) + 1);

    // Record slow requests
    if (duration > this.config.slowRequestThreshold) {
      this.recordSlowRequest({
        ...requestData,
        endpointKey
      });
    }

    // Log performance data
    logger.performance.apiRequest(endpointKey, duration, {
      statusCode,
      userId,
      ip,
      requestId: requestData.requestId
    });

    // Check for performance alerts
    this.checkPerformanceAlerts(endpointKey, endpointMetric);
  }

  /**
   * Record error metrics
   */
  recordError(errorData) {
    const { method, path, error, duration, timestamp } = errorData;
    const endpointKey = `${method} ${this.normalizeEndpoint(path)}`;

    // Update error rates
    if (!this.metrics.errorRates.has(endpointKey)) {
      this.metrics.errorRates.set(endpointKey, {
        count: 0,
        lastError: null,
        errors: []
      });
    }

    const errorMetric = this.metrics.errorRates.get(endpointKey);
    errorMetric.count++;
    errorMetric.lastError = { error, timestamp, duration };
    errorMetric.errors.push({ error, timestamp, duration });

    // Keep only recent errors
    const oneHourAgo = timestamp - 60 * 60 * 1000;
    errorMetric.errors = errorMetric.errors.filter(e => e.timestamp > oneHourAgo);

    logger.error('API Error recorded', {
      endpoint: endpointKey,
      error,
      duration,
      ...errorData
    });
  }

  /**
   * Record slow request
   */
  recordSlowRequest(requestData) {
    this.metrics.slowRequests.push({
      ...requestData,
      recordedAt: Date.now()
    });

    // Keep only recent slow requests
    if (this.metrics.slowRequests.length > this.config.maxSlowRequestsStored) {
      this.metrics.slowRequests = this.metrics.slowRequests.slice(
        -this.config.maxSlowRequestsStored
      );
    }

    logger.warn('Slow API request detected', {
      endpoint: requestData.endpointKey,
      duration: requestData.duration,
      threshold: this.config.slowRequestThreshold,
      requestId: requestData.requestId
    });
  }

  /**
   * Normalize endpoint path for grouping
   */
  normalizeEndpoint(path) {
    // Replace IDs and UUIDs with placeholders
    return path
      .replace(/\/[0-9a-f]{24}\b/gi, '/:id') // MongoDB ObjectIds
      .replace(/\/\d+/g, '/:id') // Numeric IDs
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid'); // UUIDs
  }

  /**
   * Check for performance alerts
   */
  checkPerformanceAlerts(endpointKey, endpointMetric) {
    const avgResponseTime = endpointMetric.totalDuration / endpointMetric.count;
    const errorRate = (endpointMetric.errors / endpointMetric.count) * 100;

    // Alert for high average response time
    if (avgResponseTime > this.config.alertThresholds.avgResponseTime) {
      logger.security('High average response time alert', {
        type: 'PERFORMANCE_ALERT',
        severity: 'medium',
        endpoint: endpointKey,
        avgResponseTime: Math.round(avgResponseTime),
        threshold: this.config.alertThresholds.avgResponseTime
      });
    }

    // Alert for high error rate
    if (errorRate > this.config.alertThresholds.errorRate && endpointMetric.count > 10) {
      logger.security('High error rate alert', {
        type: 'ERROR_RATE_ALERT',
        severity: 'high',
        endpoint: endpointKey,
        errorRate: Math.round(errorRate * 100) / 100,
        threshold: this.config.alertThresholds.errorRate
      });
    }
  }

  /**
   * Clean up old metrics
   */
  cleanupOldMetrics() {
    const cutoffTime = Date.now() - this.config.metricsRetentionTime;

    // Clean up request metrics
    for (const [timestamp] of this.metrics.requests.entries()) {
      if (timestamp < cutoffTime) {
        this.metrics.requests.delete(timestamp);
      }
    }

    // Clean up slow requests
    this.metrics.slowRequests = this.metrics.slowRequests.filter(
      req => req.recordedAt > cutoffTime
    );

    // Clean up error rates
    for (const [endpointKey, errorMetric] of this.metrics.errorRates.entries()) {
      errorMetric.errors = errorMetric.errors.filter(error => error.timestamp > cutoffTime);
      if (errorMetric.errors.length === 0) {
        this.metrics.errorRates.delete(endpointKey);
      }
    }

    logger.debug('Metrics cleanup completed', {
      activeRequests: this.metrics.requests.size,
      activeEndpoints: this.metrics.endpoints.size,
      slowRequests: this.metrics.slowRequests.length
    });
  }

  /**
   * Aggregate metrics for storage
   */
  async aggregateMetrics() {
    try {
      const aggregatedData = {
        timestamp: Date.now(),
        uptime: Date.now() - this.startTime,
        summary: this.getMetricsSummary(),
        topEndpoints: this.getTopEndpoints(),
        errorSummary: this.getErrorSummary()
      };

      // Store aggregated data in cache
      await cacheService.set('api_metrics_latest', aggregatedData, 3600); // 1 hour TTL

      // Store historical data
      const historyKey = `api_metrics_${new Date().toISOString().substr(0, 13)}`; // Hour-based key
      await cacheService.set(historyKey, aggregatedData, 7 * 24 * 3600); // 7 days TTL

      logger.debug('Metrics aggregated and stored');
    } catch (error) {
      logger.error('Failed to aggregate metrics:', error);
    }
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary() {
    let totalRequests = 0;
    let totalDuration = 0;
    let totalErrors = 0;

    for (const metric of this.metrics.requests.values()) {
      totalRequests += metric.count;
      totalDuration += metric.totalDuration;
      totalErrors += metric.errors;
    }

    const avgResponseTime = totalRequests > 0 ? totalDuration / totalRequests : 0;
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    return {
      totalRequests,
      totalErrors,
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      slowRequestCount: this.metrics.slowRequests.length,
      uniqueEndpoints: this.metrics.endpoints.size
    };
  }

  /**
   * Get top endpoints by various metrics
   */
  getTopEndpoints(limit = 10) {
    const endpoints = Array.from(this.metrics.endpoints.entries()).map(([key, metric]) => ({
      endpoint: key,
      count: metric.count,
      avgDuration: Math.round((metric.totalDuration / metric.count) * 100) / 100,
      maxDuration: metric.maxDuration,
      minDuration: metric.minDuration === Infinity ? 0 : metric.minDuration,
      errorRate: Math.round((metric.errors / metric.count) * 100 * 100) / 100,
      lastAccessed: metric.lastAccessed
    }));

    return {
      byRequestCount: endpoints.sort((a, b) => b.count - a.count).slice(0, limit),
      byAvgDuration: endpoints.sort((a, b) => b.avgDuration - a.avgDuration).slice(0, limit),
      byErrorRate: endpoints.sort((a, b) => b.errorRate - a.errorRate).slice(0, limit)
    };
  }

  /**
   * Get error summary
   */
  getErrorSummary() {
    const errorSummary = {};

    for (const [endpoint, errorMetric] of this.metrics.errorRates.entries()) {
      errorSummary[endpoint] = {
        totalErrors: errorMetric.count,
        recentErrors: errorMetric.errors.length,
        lastError: errorMetric.lastError
      };
    }

    return errorSummary;
  }

  /**
   * Get real-time metrics
   */
  getRealTimeMetrics() {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    // Count requests in last minute and 5 minutes
    let requestsLastMinute = 0;
    let requestsLast5Minutes = 0;
    let errorsLastMinute = 0;
    let errorsLast5Minutes = 0;

    for (const [timestamp, metric] of this.metrics.requests.entries()) {
      if (timestamp > oneMinuteAgo) {
        requestsLastMinute += metric.count;
        errorsLastMinute += metric.errors;
      }
      if (timestamp > fiveMinutesAgo) {
        requestsLast5Minutes += metric.count;
        errorsLast5Minutes += metric.errors;
      }
    }

    return {
      timestamp: now,
      uptime: now - this.startTime,
      requestsPerMinute: requestsLastMinute,
      requestsPer5Minutes: requestsLast5Minutes,
      errorsPerMinute: errorsLastMinute,
      errorsPer5Minutes: errorsLast5Minutes,
      activeSlowRequests: this.metrics.slowRequests.filter(req => req.recordedAt > fiveMinutesAgo)
        .length,
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Get detailed endpoint statistics
   */
  getEndpointDetails(endpoint) {
    const metric = this.metrics.endpoints.get(endpoint);
    if (!metric) {
      return null;
    }

    const errorMetric = this.metrics.errorRates.get(endpoint);
    const recentSlowRequests = this.metrics.slowRequests.filter(
      req => req.endpointKey === endpoint
    );

    return {
      endpoint,
      statistics: {
        totalRequests: metric.count,
        avgResponseTime: Math.round((metric.totalDuration / metric.count) * 100) / 100,
        minResponseTime: metric.minDuration === Infinity ? 0 : metric.minDuration,
        maxResponseTime: metric.maxDuration,
        errorCount: metric.errors,
        errorRate: Math.round((metric.errors / metric.count) * 100 * 100) / 100,
        lastAccessed: new Date(metric.lastAccessed).toISOString()
      },
      statusCodeDistribution: Object.fromEntries(metric.statusCodes),
      recentErrors: errorMetric ? errorMetric.errors.slice(-10) : [],
      recentSlowRequests: recentSlowRequests.slice(-10)
    };
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport() {
    try {
      const summary = this.getMetricsSummary();
      const topEndpoints = this.getTopEndpoints();
      const realTimeMetrics = this.getRealTimeMetrics();
      const errorSummary = this.getErrorSummary();

      const report = {
        generatedAt: new Date().toISOString(),
        period: {
          startTime: new Date(this.startTime).toISOString(),
          duration: realTimeMetrics.uptime
        },
        summary,
        realTimeMetrics,
        topEndpoints,
        errorSummary,
        configuration: this.config,
        recommendations: this.generateRecommendations(summary, topEndpoints)
      };

      // Store report
      await cacheService.set('api_performance_report_latest', report, 3600);

      return report;
    } catch (error) {
      logger.error('Failed to generate performance report:', error);
      return { error: error.message };
    }
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(summary, topEndpoints) {
    const recommendations = [];

    // High error rate recommendation
    if (summary.errorRate > 2) {
      recommendations.push({
        type: 'ERROR_RATE',
        severity: 'high',
        message: `Error rate is ${summary.errorRate}%. Consider investigating error patterns.`
      });
    }

    // Slow response time recommendation
    if (summary.avgResponseTime > 500) {
      recommendations.push({
        type: 'RESPONSE_TIME',
        severity: 'medium',
        message: `Average response time is ${summary.avgResponseTime}ms. Consider optimization.`
      });
    }

    // Slow endpoints recommendation
    const slowEndpoints = topEndpoints.byAvgDuration.filter(ep => ep.avgDuration > 1000);
    if (slowEndpoints.length > 0) {
      recommendations.push({
        type: 'SLOW_ENDPOINTS',
        severity: 'medium',
        message: `${slowEndpoints.length} endpoints have response times > 1s`,
        endpoints: slowEndpoints.slice(0, 3).map(ep => ep.endpoint)
      });
    }

    // High traffic endpoints
    const highTrafficEndpoints = topEndpoints.byRequestCount.filter(ep => ep.count > 1000);
    if (highTrafficEndpoints.length > 0) {
      recommendations.push({
        type: 'HIGH_TRAFFIC',
        severity: 'info',
        message: `Consider caching for high-traffic endpoints`,
        endpoints: highTrafficEndpoints.slice(0, 3).map(ep => ep.endpoint)
      });
    }

    return recommendations;
  }
}

// Export singleton instance
const apiPerformanceMonitor = new APIPerformanceMonitor();

module.exports = apiPerformanceMonitor;
