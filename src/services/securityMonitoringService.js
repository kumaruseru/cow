const logger = require('../utils/logger');
const cacheService = require('./cacheService');

class SecurityMonitoringService {
  constructor() {
    this.suspiciousPatterns = new Set();
    this.alertThresholds = {
      failedLogins: 5, // per 15 minutes
      rapidRequests: 100, // per minute
      multipleIPs: 3, // per user per hour
      suspiciousEndpoints: 10 // per hour
    };
    this.whitelistedIPs = new Set(['127.0.0.1', '::1']);
  }

  /**
   * Monitor authentication attempts
   */
  async monitorAuthAttempt(req, success, userId = null) {
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    const timestamp = Date.now();

    const event = {
      type: 'auth_attempt',
      success,
      userId,
      ip,
      userAgent,
      timestamp,
      endpoint: req.originalUrl
    };

    // Log authentication attempt
    logger.security.loginAttempt(userId, success, event);

    if (!success) {
      await this.handleFailedLogin(ip, userId, event);
    } else {
      await this.handleSuccessfulLogin(ip, userId, event);
    }

    return event;
  }

  /**
   * Handle failed login attempts
   */
  async handleFailedLogin(ip, userId, event) {
    const key = `failed_logins:${ip}`;
    const attempts = await cacheService.incr(key, 900); // 15 minutes

    logger.warn('Failed login attempt', {
      ip,
      userId,
      attempts,
      ...event
    });

    if (attempts >= this.alertThresholds.failedLogins) {
      await this.triggerSecurityAlert('MULTIPLE_FAILED_LOGINS', {
        ip,
        userId,
        attempts,
        severity: 'high',
        action: 'rate_limit'
      });
    }

    // Check for distributed attacks
    await this.checkDistributedAttack(userId, event);
  }

  /**
   * Handle successful login
   */
  async handleSuccessfulLogin(ip, userId, event) {
    if (!userId) return;

    // Check for multiple IPs
    const ipKey = `user_ips:${userId}`;
    const ips = (await cacheService.get(ipKey)) || [];

    if (!ips.includes(ip)) {
      ips.push(ip);
      await cacheService.set(ipKey, ips, 3600); // 1 hour

      if (ips.length > this.alertThresholds.multipleIPs) {
        await this.triggerSecurityAlert('MULTIPLE_IP_LOGIN', {
          userId,
          ips,
          severity: 'medium',
          action: 'verify_identity'
        });
      }
    }

    // Clear failed login attempts on successful login
    await cacheService.del(`failed_logins:${ip}`);
  }

  /**
   * Monitor API requests for suspicious patterns
   */
  async monitorRequest(req, res, responseTime) {
    const ip = req.ip || req.connection.remoteAddress;
    const endpoint = req.originalUrl;
    const method = req.method;
    const userAgent = req.get('User-Agent');
    const userId = req.user?.id;

    const event = {
      type: 'api_request',
      ip,
      endpoint,
      method,
      userAgent,
      userId,
      statusCode: res.statusCode,
      responseTime,
      timestamp: Date.now()
    };

    // Check for rapid requests
    await this.checkRapidRequests(ip, event);

    // Check for suspicious endpoints
    await this.checkSuspiciousEndpoints(ip, endpoint, event);

    // Check for unusual user agent patterns
    await this.checkUserAgent(userAgent, event);

    // Monitor error rates
    if (res.statusCode >= 400) {
      await this.monitorErrorRates(ip, res.statusCode, event);
    }

    return event;
  }

  /**
   * Check for rapid requests (potential DDoS)
   */
  async checkRapidRequests(ip, event) {
    if (this.whitelistedIPs.has(ip)) return;

    const key = `requests:${ip}`;
    const requests = await cacheService.incr(key, 60); // 1 minute window

    if (requests > this.alertThresholds.rapidRequests) {
      await this.triggerSecurityAlert('RAPID_REQUESTS', {
        ip,
        requests,
        severity: 'high',
        action: 'rate_limit',
        ...event
      });
    }
  }

  /**
   * Check for access to suspicious endpoints
   */
  async checkSuspiciousEndpoints(ip, endpoint, event) {
    const suspiciousPatterns = [
      /\/admin/,
      /\/api\/.*\/delete/,
      /\/api\/.*\/admin/,
      /\/\.env/,
      /\/config/,
      /\/wp-admin/,
      /\/phpmyadmin/
    ];

    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(endpoint));

    if (isSuspicious) {
      const key = `suspicious:${ip}`;
      const count = await cacheService.incr(key, 3600); // 1 hour

      logger.warn('Suspicious endpoint access', {
        ip,
        endpoint,
        count,
        ...event
      });

      if (count > this.alertThresholds.suspiciousEndpoints) {
        await this.triggerSecurityAlert('SUSPICIOUS_ENDPOINT_ACCESS', {
          ip,
          endpoint,
          count,
          severity: 'critical',
          action: 'block_ip'
        });
      }
    }
  }

  /**
   * Check user agent for suspicious patterns
   */
  async checkUserAgent(userAgent, event) {
    if (!userAgent) {
      await this.triggerSecurityAlert('MISSING_USER_AGENT', {
        ...event,
        severity: 'low'
      });
      return;
    }

    const suspiciousUAPatterns = [
      /bot/i,
      /crawler/i,
      /scanner/i,
      /curl/i,
      /wget/i,
      /python/i,
      /exploit/i
    ];

    const isSuspicious = suspiciousUAPatterns.some(pattern => pattern.test(userAgent));

    if (isSuspicious) {
      logger.warn('Suspicious user agent detected', {
        userAgent,
        ...event
      });
    }
  }

  /**
   * Monitor error rates
   */
  async monitorErrorRates(ip, statusCode, event) {
    const key = `errors:${ip}:${statusCode}`;
    const count = await cacheService.incr(key, 300); // 5 minutes

    // Alert on high error rates
    if (count > 20 && [401, 403, 404, 500].includes(statusCode)) {
      await this.triggerSecurityAlert('HIGH_ERROR_RATE', {
        ip,
        statusCode,
        count,
        severity: 'medium',
        ...event
      });
    }
  }

  /**
   * Check for distributed attacks
   */
  async checkDistributedAttack(userId, event) {
    if (!userId) return;

    const key = `distributed:${userId}`;
    const attempts = (await cacheService.get(key)) || [];

    attempts.push({
      ip: event.ip,
      timestamp: event.timestamp,
      userAgent: event.userAgent
    });

    // Keep only last hour
    const oneHourAgo = Date.now() - 3600000;
    const recentAttempts = attempts.filter(attempt => attempt.timestamp > oneHourAgo);

    await cacheService.set(key, recentAttempts, 3600);

    // Check for multiple IPs
    const uniqueIPs = new Set(recentAttempts.map(attempt => attempt.ip));

    if (uniqueIPs.size > 5) {
      await this.triggerSecurityAlert('DISTRIBUTED_ATTACK', {
        userId,
        ips: Array.from(uniqueIPs),
        attempts: recentAttempts.length,
        severity: 'critical',
        action: 'account_lockout'
      });
    }
  }

  /**
   * Trigger security alert
   */
  async triggerSecurityAlert(alertType, details) {
    const alert = {
      id: this.generateAlertId(),
      type: alertType,
      timestamp: new Date().toISOString(),
      severity: details.severity || 'medium',
      details,
      resolved: false
    };

    // Log the alert
    logger.error('SECURITY ALERT TRIGGERED', alert);

    // Store alert for dashboard
    await cacheService.set(`alert:${alert.id}`, alert, 86400); // 24 hours

    // Add to active alerts list
    const activeAlerts = (await cacheService.get('active_alerts')) || [];
    activeAlerts.push(alert.id);
    await cacheService.set('active_alerts', activeAlerts, 86400);

    // Execute automated response
    await this.executeAutomatedResponse(alert);

    return alert;
  }

  /**
   * Execute automated response to threats
   */
  async executeAutomatedResponse(alert) {
    const { type, details } = alert;

    switch (details.action) {
      case 'rate_limit':
        await this.implementRateLimit(details.ip);
        break;

      case 'block_ip':
        await this.blockIP(details.ip);
        break;

      case 'account_lockout':
        await this.lockAccount(details.userId);
        break;

      case 'verify_identity':
        await this.requestIdentityVerification(details.userId);
        break;
    }

    logger.info('Automated response executed', {
      alertType: type,
      action: details.action,
      target: details.ip || details.userId
    });
  }

  /**
   * Implement rate limiting for IP
   */
  async implementRateLimit(ip) {
    const key = `rate_limit:${ip}`;
    await cacheService.set(key, true, 3600); // 1 hour block
    logger.warn('Rate limit implemented', { ip });
  }

  /**
   * Block IP address
   */
  async blockIP(ip) {
    const key = `blocked_ip:${ip}`;
    await cacheService.set(key, true, 86400); // 24 hour block
    logger.error('IP address blocked', { ip });
  }

  /**
   * Lock user account
   */
  async lockAccount(userId) {
    const key = `locked_account:${userId}`;
    await cacheService.set(key, true, 3600); // 1 hour lock
    logger.error('Account locked due to security threat', { userId });
  }

  /**
   * Request identity verification
   */
  async requestIdentityVerification(userId) {
    const key = `verify_identity:${userId}`;
    await cacheService.set(key, true, 86400); // 24 hours
    logger.warn('Identity verification required', { userId });
  }

  /**
   * Check if IP is blocked
   */
  async isIPBlocked(ip) {
    const blocked = await cacheService.get(`blocked_ip:${ip}`);
    const rateLimited = await cacheService.get(`rate_limit:${ip}`);
    return !!(blocked || rateLimited);
  }

  /**
   * Check if account is locked
   */
  async isAccountLocked(userId) {
    const locked = await cacheService.get(`locked_account:${userId}`);
    return !!locked;
  }

  /**
   * Get security dashboard data
   */
  async getSecurityDashboard() {
    const activeAlerts = (await cacheService.get('active_alerts')) || [];
    const alerts = [];

    for (const alertId of activeAlerts) {
      const alert = await cacheService.get(`alert:${alertId}`);
      if (alert) alerts.push(alert);
    }

    const stats = await cacheService.getStats();

    return {
      alerts: alerts.slice(0, 50), // Latest 50 alerts
      statistics: {
        totalAlerts: alerts.length,
        criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
        highAlerts: alerts.filter(a => a.severity === 'high').length,
        cacheStats: stats
      }
    };
  }

  /**
   * Generate unique alert ID
   */
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize monitoring service
   */
  async initialize() {
    logger.info('Security monitoring service initialized');

    // Set up periodic cleanup
    setInterval(async () => {
      await this.cleanupExpiredAlerts();
    }, 3600000); // Every hour
  }

  /**
   * Cleanup expired alerts
   */
  async cleanupExpiredAlerts() {
    try {
      const activeAlerts = (await cacheService.get('active_alerts')) || [];
      const validAlerts = [];

      for (const alertId of activeAlerts) {
        const alert = await cacheService.get(`alert:${alertId}`);
        if (alert) {
          validAlerts.push(alertId);
        }
      }

      await cacheService.set('active_alerts', validAlerts, 86400);
      logger.debug('Expired alerts cleaned up', {
        before: activeAlerts.length,
        after: validAlerts.length
      });
    } catch (error) {
      logger.error('Alert cleanup failed:', error);
    }
  }
}

// Export singleton instance
const securityMonitoringService = new SecurityMonitoringService();

module.exports = securityMonitoringService;
