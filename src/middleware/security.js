const logger = require('../utils/logger');
const { auditSuspiciousActivity } = require('./securityAudit');

/**
 * Middleware to check if device is trusted
 */
const requireTrustedDevice = async (req, res, next) => {
  try {
    const user = req.user;
    const deviceId = req.headers['x-device-id'];
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Skip check if user doesn't have 2FA enabled
    if (!user.twoFactorAuth.enabled) {
      return next();
    }

    // Check if device ID is provided
    if (!deviceId) {
      return res.status(403).json({
        success: false,
        error: 'Device ID required for this action',
        requiresDeviceAuth: true
      });
    }

    // Check if device is trusted
    const isTrustedDevice = user.isTrustedDevice(deviceId);

    if (!isTrustedDevice) {
      // Log suspicious activity
      logger.warn(`Untrusted device access attempt: ${deviceId} for user ${user.username}`);

      // Audit the event
      auditSuspiciousActivity(req, res, next);

      return res.status(403).json({
        success: false,
        error: 'Device not trusted. Please verify your identity.',
        requiresDeviceAuth: true,
        deviceId: deviceId
      });
    }

    // Update device last seen
    try {
      await user.updateDeviceLastSeen(deviceId, ipAddress);
    } catch (updateError) {
      logger.warn('Failed to update device last seen:', updateError);
    }

    next();
  } catch (error) {
    logger.error('Trusted device check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify device trust status'
    });
  }
};

/**
 * Middleware to require 2FA verification for sensitive operations
 */
const require2FA = async (req, res, next) => {
  try {
    const user = req.user;

    // Skip if 2FA is not enabled
    if (!user.twoFactorAuth.enabled) {
      return next();
    }

    const twoFactorToken = req.headers['x-2fa-token'] || req.body.twoFactorToken;

    if (!twoFactorToken) {
      return res.status(403).json({
        success: false,
        error: 'Two-factor authentication required',
        requires2FA: true
      });
    }

    // Verify token
    const isValid = await user.verifyTwoFactorToken(twoFactorToken);

    if (!isValid) {
      logger.warn(`Invalid 2FA token attempt for user ${user.username}`);

      return res.status(401).json({
        success: false,
        error: 'Invalid two-factor authentication token',
        requires2FA: true
      });
    }

    next();
  } catch (error) {
    logger.error('2FA verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify two-factor authentication'
    });
  }
};

/**
 * Middleware to check session validity and security
 */
const checkSessionSecurity = async (req, res, next) => {
  try {
    const user = req.user;
    const sessionId = req.headers['x-session-id'];
    const deviceId = req.headers['x-device-id'];
    const ipAddress = req.ip || req.connection.remoteAddress;

    if (!sessionId) {
      return res.status(401).json({
        success: false,
        error: 'Session ID required'
      });
    }

    // Check if session exists and is valid
    const session = user.activeSessions.find(s => s.sessionId === sessionId);

    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Invalid session'
      });
    }

    // Check session expiry
    if (session.expiresAt < new Date()) {
      // Remove expired session
      await user.removeSession(sessionId);

      return res.status(401).json({
        success: false,
        error: 'Session expired'
      });
    }

    // Check if IP address matches (optional security check)
    if (process.env.STRICT_IP_CHECK === 'true' && session.ipAddress !== ipAddress) {
      logger.warn(
        `IP address mismatch for session ${sessionId}: expected ${session.ipAddress}, got ${ipAddress}`
      );

      return res.status(401).json({
        success: false,
        error: 'Session security violation'
      });
    }

    // Check if device matches
    if (deviceId && session.deviceId !== deviceId) {
      logger.warn(
        `Device ID mismatch for session ${sessionId}: expected ${session.deviceId}, got ${deviceId}`
      );

      return res.status(401).json({
        success: false,
        error: 'Session security violation'
      });
    }

    // Update session last activity
    session.lastActivity = new Date();
    await user.save({ validateBeforeSave: false });

    next();
  } catch (error) {
    logger.error('Session security check error:', error);
    res.status(500).json({
      success: false,
      error: 'Session security check failed'
    });
  }
};

/**
 * Middleware to detect and prevent brute force attacks
 */
const bruteForceProtection = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const attempts = new Map();

  return (req, res, next) => {
    const key = req.ip + ':' + (req.user?.id || 'anonymous');
    const now = Date.now();

    // Clean old attempts
    const userAttempts = attempts.get(key) || [];
    const recentAttempts = userAttempts.filter(attempt => now - attempt < windowMs);

    // Check if too many attempts
    if (recentAttempts.length >= maxAttempts) {
      logger.warn(
        `Brute force attempt detected from ${req.ip} for user ${req.user?.username || 'anonymous'}`
      );

      return res.status(429).json({
        success: false,
        error: 'Too many attempts. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    // Track this attempt on failure
    const originalSend = res.send;
    res.send = function (data) {
      if (res.statusCode >= 400) {
        recentAttempts.push(now);
        attempts.set(key, recentAttempts);
      }
      return originalSend.call(this, data);
    };

    next();
  };
};

/**
 * Middleware to validate request origin and prevent CSRF
 */
const validateOrigin = (req, res, next) => {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'];

  // Skip validation for GET requests and if no origin/referer
  if (req.method === 'GET' || (!origin && !referer)) {
    return next();
  }

  const requestOrigin = origin || (referer ? new URL(referer).origin : null);

  if (!requestOrigin || !allowedOrigins.includes(requestOrigin)) {
    logger.warn(`Invalid origin attempt: ${requestOrigin} from IP ${req.ip}`);

    return res.status(403).json({
      success: false,
      error: 'Invalid request origin'
    });
  }

  next();
};

/**
 * Middleware to check user account status
 */
const checkAccountStatus = (req, res, next) => {
  const user = req.user;

  // Check if account is locked
  if (user.accountLockUntil && user.accountLockUntil > Date.now()) {
    const lockTimeRemaining = Math.ceil((user.accountLockUntil - Date.now()) / 1000 / 60);

    return res.status(423).json({
      success: false,
      error: `Account is locked. Try again in ${lockTimeRemaining} minutes.`,
      lockTimeRemaining: lockTimeRemaining
    });
  }

  // Check if account is deactivated
  if (user.status === 'deactivated') {
    return res.status(403).json({
      success: false,
      error: 'Account is deactivated'
    });
  }

  // Check if account requires verification
  if (user.status === 'pending' && req.path !== '/verify-email') {
    return res.status(403).json({
      success: false,
      error: 'Account email verification required',
      requiresVerification: true
    });
  }

  next();
};

module.exports = {
  requireTrustedDevice,
  require2FA,
  checkSessionSecurity,
  bruteForceProtection,
  validateOrigin,
  checkAccountStatus
};
