const logger = require('../utils/logger');
const User = require('../models/User');

/**
 * Security audit middleware to log and track security events
 */
const securityAudit = (eventType, severity = 'info') => {
  return async (req, res, next) => {
    const originalSend = res.send;

    res.send = function (data) {
      // Log security event
      logSecurityEvent(req, res, eventType, severity, data);
      return originalSend.call(this, data);
    };

    next();
  };
};

/**
 * Log security events to database and logger
 */
const logSecurityEvent = async (req, res, eventType, severity, responseData) => {
  try {
    const userId = req.user?.id;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const deviceId = req.headers['x-device-id'];
    const location = req.headers['x-location'] || 'Unknown';

    const eventData = {
      eventType,
      severity,
      ipAddress,
      userAgent,
      deviceId,
      location,
      endpoint: req.originalUrl,
      method: req.method,
      statusCode: res.statusCode,
      timestamp: new Date(),
      details: {
        requestBody: filterSensitiveData(req.body),
        params: req.params,
        query: req.query,
        headers: filterSensitiveHeaders(req.headers)
      }
    };

    // Add response info for failed requests
    if (res.statusCode >= 400) {
      eventData.details.response = filterSensitiveData(responseData);
    }

    // Log to system logger
    const logMessage = `Security Event: ${eventType} - User: ${userId || 'Anonymous'} - IP: ${ipAddress} - Status: ${res.statusCode}`;

    switch (severity) {
      case 'critical':
        logger.error(logMessage, eventData);
        break;
      case 'high':
        logger.warn(logMessage, eventData);
        break;
      case 'medium':
        logger.info(logMessage, eventData);
        break;
      case 'low':
      default:
        logger.debug(logMessage, eventData);
        break;
    }

    // Save to user's security audit trail if user is authenticated
    if (userId) {
      try {
        const user = await User.findById(userId);
        if (user) {
          await user.logSecurityEvent(eventData);
        }
      } catch (dbError) {
        logger.error('Failed to save security event to database:', dbError);
      }
    }

    // Send alerts for critical events
    if (severity === 'critical') {
      await sendSecurityAlert(eventData);
    }
  } catch (error) {
    logger.error('Security audit logging failed:', error);
  }
};

/**
 * Filter sensitive data from request/response
 */
const filterSensitiveData = data => {
  if (!data || typeof data !== 'object') return data;

  const filtered = { ...data };
  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'key',
    'authorization',
    'cookie',
    'session',
    'jwt',
    'refresh_token',
    'access_token',
    'api_key',
    'private_key',
    'credit_card',
    'ssn',
    'pin'
  ];

  const filterObject = obj => {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        result[key] = '[REDACTED]';
      } else if (value && typeof value === 'object') {
        result[key] = filterObject(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  };

  return filterObject(filtered);
};

/**
 * Filter sensitive headers
 */
const filterSensitiveHeaders = headers => {
  const filtered = { ...headers };
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token', 'x-session-id'];

  sensitiveHeaders.forEach(header => {
    if (filtered[header]) {
      filtered[header] = '[REDACTED]';
    }
  });

  return filtered;
};

/**
 * Send security alerts for critical events
 */
const sendSecurityAlert = async eventData => {
  try {
    // Here you would implement your alerting system
    // Examples: Email, Slack, PagerDuty, SMS, etc.

    logger.error('CRITICAL SECURITY EVENT DETECTED:', {
      eventType: eventData.eventType,
      userId: eventData.userId,
      ipAddress: eventData.ipAddress,
      timestamp: eventData.timestamp,
      endpoint: eventData.endpoint,
      statusCode: eventData.statusCode
    });

    // Example: Send email alert (implement based on your email service)
    // await sendEmailAlert(eventData);

    // Example: Send Slack notification (implement based on your Slack setup)
    // await sendSlackAlert(eventData);
  } catch (error) {
    logger.error('Failed to send security alert:', error);
  }
};

/**
 * Middleware for failed login attempts
 */
const auditFailedLogin = securityAudit('FAILED_LOGIN', 'medium');

/**
 * Middleware for successful login
 */
const auditSuccessfulLogin = securityAudit('SUCCESSFUL_LOGIN', 'low');

/**
 * Middleware for logout
 */
const auditLogout = securityAudit('LOGOUT', 'low');

/**
 * Middleware for password changes
 */
const auditPasswordChange = securityAudit('PASSWORD_CHANGE', 'medium');

/**
 * Middleware for 2FA setup/disable
 */
const auditTwoFactorChange = securityAudit('TWO_FACTOR_CHANGE', 'high');

/**
 * Middleware for account lockout
 */
const auditAccountLockout = securityAudit('ACCOUNT_LOCKOUT', 'high');

/**
 * Middleware for suspicious activity
 */
const auditSuspiciousActivity = securityAudit('SUSPICIOUS_ACTIVITY', 'critical');

/**
 * Middleware for permission escalation attempts
 */
const auditPermissionEscalation = securityAudit('PERMISSION_ESCALATION', 'critical');

/**
 * Middleware for data access
 */
const auditDataAccess = securityAudit('DATA_ACCESS', 'low');

/**
 * Middleware for data modification
 */
const auditDataModification = securityAudit('DATA_MODIFICATION', 'medium');

/**
 * Middleware for administrative actions
 */
const auditAdminAction = securityAudit('ADMIN_ACTION', 'high');

/**
 * Device trust events
 */
const auditDeviceTrust = securityAudit('DEVICE_TRUST_CHANGE', 'medium');

/**
 * API key usage
 */
const auditApiKeyUsage = securityAudit('API_KEY_USAGE', 'low');

/**
 * Rate limit violations
 */
const auditRateLimitViolation = securityAudit('RATE_LIMIT_VIOLATION', 'medium');

module.exports = {
  securityAudit,
  auditFailedLogin,
  auditSuccessfulLogin,
  auditLogout,
  auditPasswordChange,
  auditTwoFactorChange,
  auditAccountLockout,
  auditSuspiciousActivity,
  auditPermissionEscalation,
  auditDataAccess,
  auditDataModification,
  auditAdminAction,
  auditDeviceTrust,
  auditApiKeyUsage,
  auditRateLimitViolation
};
