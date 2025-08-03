const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('redis');
const logger = require('../utils/logger');
const cacheService = require('./cacheService');

class AdvancedRateLimitService {
  constructor() {
    this.redisClient = null;
    this.limiters = new Map();
    this.customRules = new Map();
    this.bypassTokens = new Set();
    this.analytics = {
      blocked: 0,
      allowed: 0,
      bypassUsed: 0,
      customRuleTriggered: 0
    };
  }

  /**
   * Initialize advanced rate limiting
   */
  async initialize() {
    try {
      // Try to create Redis client for rate limiting
      if (process.env.REDIS_URL) {
        this.redisClient = redis.createClient({ url: process.env.REDIS_URL });
        await this.redisClient.connect();
        logger.info('Redis client connected for rate limiting');
      }

      // Setup different rate limiting rules
      this.setupDefaultLimiters();
      this.setupCustomRules();
      this.setupBypassTokens();

      logger.info('Advanced rate limiting service initialized');
    } catch (error) {
      logger.warn('Redis not available for rate limiting, using memory store:', error.message);
      this.setupDefaultLimiters();
    }
  }

  /**
   * Setup default rate limiters
   */
  setupDefaultLimiters() {
    const store = this.redisClient
      ? new RedisStore({ sendCommand: (...args) => this.redisClient.sendCommand(args) })
      : undefined;

    // API Rate Limiter - General API calls
    this.limiters.set(
      'api',
      rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000, // Limit each IP to 1000 requests per windowMs
        message: {
          error: 'Too many API requests',
          retryAfter: 15 * 60,
          limit: 1000
        },
        standardHeaders: true,
        legacyHeaders: false,
        store,
        keyGenerator: req => this.generateKey(req, 'api'),
        onLimitReached: req => this.onLimitReached(req, 'api')
      })
    );

    // Authentication Rate Limiter - Login attempts
    this.limiters.set(
      'auth',
      rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // Limit each IP to 5 login attempts per windowMs
        message: {
          error: 'Too many login attempts',
          retryAfter: 15 * 60,
          limit: 5
        },
        standardHeaders: true,
        legacyHeaders: false,
        store,
        keyGenerator: req => this.generateKey(req, 'auth'),
        onLimitReached: req => this.onLimitReached(req, 'auth'),
        skipSuccessfulRequests: true
      })
    );

    // Registration Rate Limiter
    this.limiters.set(
      'register',
      rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 3, // Limit each IP to 3 registration attempts per hour
        message: {
          error: 'Too many registration attempts',
          retryAfter: 60 * 60,
          limit: 3
        },
        standardHeaders: true,
        legacyHeaders: false,
        store,
        keyGenerator: req => this.generateKey(req, 'register'),
        onLimitReached: req => this.onLimitReached(req, 'register')
      })
    );

    // Password Reset Rate Limiter
    this.limiters.set(
      'passwordReset',
      rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 3, // Limit each IP to 3 password reset attempts per hour
        message: {
          error: 'Too many password reset attempts',
          retryAfter: 60 * 60,
          limit: 3
        },
        standardHeaders: true,
        legacyHeaders: false,
        store,
        keyGenerator: req => this.generateKey(req, 'passwordReset'),
        onLimitReached: req => this.onLimitReached(req, 'passwordReset')
      })
    );

    // Upload Rate Limiter
    this.limiters.set(
      'upload',
      rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 50, // Limit each IP to 50 uploads per 15 minutes
        message: {
          error: 'Too many upload attempts',
          retryAfter: 15 * 60,
          limit: 50
        },
        standardHeaders: true,
        legacyHeaders: false,
        store,
        keyGenerator: req => this.generateKey(req, 'upload'),
        onLimitReached: req => this.onLimitReached(req, 'upload')
      })
    );

    // Heavy Operations Rate Limiter (search, analytics)
    this.limiters.set(
      'heavy',
      rateLimit({
        windowMs: 5 * 60 * 1000, // 5 minutes
        max: 20, // Limit each IP to 20 heavy operations per 5 minutes
        message: {
          error: 'Too many resource-intensive requests',
          retryAfter: 5 * 60,
          limit: 20
        },
        standardHeaders: true,
        legacyHeaders: false,
        store,
        keyGenerator: req => this.generateKey(req, 'heavy'),
        onLimitReached: req => this.onLimitReached(req, 'heavy')
      })
    );
  }

  /**
   * Setup custom rate limiting rules
   */
  setupCustomRules() {
    // User-based rate limiting
    this.customRules.set('userBased', {
      windowMs: 15 * 60 * 1000,
      max: 2000, // Authenticated users get higher limits
      keyGenerator: req => req.user?.id || req.ip,
      condition: req => !!req.user
    });

    // Premium user rate limiting
    this.customRules.set('premiumUser', {
      windowMs: 15 * 60 * 1000,
      max: 5000, // Premium users get even higher limits
      keyGenerator: req => req.user?.id,
      condition: req => req.user?.isPremium
    });

    // API key based rate limiting
    this.customRules.set('apiKey', {
      windowMs: 15 * 60 * 1000,
      max: 10000, // API keys get highest limits
      keyGenerator: req => req.headers['x-api-key'],
      condition: req => !!req.headers['x-api-key']
    });

    // Geographic rate limiting (if IP geolocation is available)
    this.customRules.set('geographic', {
      windowMs: 15 * 60 * 1000,
      max: 100, // Lower limits for certain regions
      keyGenerator: req => req.ip,
      condition: req => {
        // This would require IP geolocation service
        const suspiciousRegions = ['TOR', 'VPN', 'PROXY'];
        return suspiciousRegions.includes(req.geoInfo?.type);
      }
    });
  }

  /**
   * Setup bypass tokens for testing and admin access
   */
  setupBypassTokens() {
    // Add some bypass tokens (in production, these should be in environment variables)
    if (process.env.RATE_LIMIT_BYPASS_TOKENS) {
      const tokens = process.env.RATE_LIMIT_BYPASS_TOKENS.split(',');
      tokens.forEach(token => this.bypassTokens.add(token.trim()));
    }

    // Add default bypass token for development
    if (process.env.NODE_ENV === 'development') {
      this.bypassTokens.add('dev-bypass-token');
    }
  }

  /**
   * Generate rate limiting key
   */
  generateKey(req, type) {
    // Check for bypass token
    const bypassToken = req.headers['x-bypass-token'];
    if (bypassToken && this.bypassTokens.has(bypassToken)) {
      this.analytics.bypassUsed++;
      return `bypass-${bypassToken}-${type}`;
    }

    // Apply custom rules
    for (const [ruleName, rule] of this.customRules.entries()) {
      if (rule.condition(req)) {
        this.analytics.customRuleTriggered++;
        return `${ruleName}-${rule.keyGenerator(req)}-${type}`;
      }
    }

    // Default to IP-based rate limiting
    return `ip-${req.ip}-${type}`;
  }

  /**
   * Handle rate limit reached
   */
  onLimitReached(req, type) {
    this.analytics.blocked++;

    const clientInfo = {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      type,
      timestamp: new Date().toISOString()
    };

    // Log security event
    logger.security('Rate limit exceeded', {
      type: 'RATE_LIMIT_EXCEEDED',
      severity: 'medium',
      client: clientInfo,
      headers: req.headers
    });

    // Store in cache for security monitoring
    cacheService.storeSecurityEvent('rate_limit_exceeded', clientInfo);

    // Trigger additional security measures for repeated violations
    this.handleRepeatedViolations(req, type);
  }

  /**
   * Handle repeated rate limit violations
   */
  async handleRepeatedViolations(req, type) {
    try {
      const key = `violations:${req.ip}:${type}`;
      const violations = await cacheService.get(key);
      const currentViolations = (violations || 0) + 1;

      await cacheService.set(key, currentViolations, 3600); // 1 hour TTL

      if (currentViolations >= 5) {
        // Implement progressive penalties
        const penaltyKey = `penalty:${req.ip}`;
        const penaltyLevel = Math.min(currentViolations - 4, 5); // Max penalty level 5

        await cacheService.set(penaltyKey, penaltyLevel, 3600 * penaltyLevel);

        logger.security('Progressive penalty applied', {
          type: 'RATE_LIMIT_PENALTY',
          severity: 'high',
          ip: req.ip,
          violations: currentViolations,
          penaltyLevel
        });
      }
    } catch (error) {
      logger.error('Failed to handle repeated violations:', error);
    }
  }

  /**
   * Get rate limiter middleware
   */
  getLimiter(type = 'api') {
    const limiter = this.limiters.get(type);
    if (!limiter) {
      logger.warn(`Rate limiter type '${type}' not found, using default 'api' limiter`);
      return this.limiters.get('api');
    }

    // Wrap the limiter to add analytics
    return (req, res, next) => {
      // Check for penalty
      this.checkPenalty(req, res, next, () => {
        // Apply the rate limiter
        limiter(req, res, err => {
          if (!err) {
            this.analytics.allowed++;
          }
          next(err);
        });
      });
    };
  }

  /**
   * Check if IP has penalty
   */
  async checkPenalty(req, res, next, proceed) {
    try {
      const penaltyKey = `penalty:${req.ip}`;
      const penaltyLevel = await cacheService.get(penaltyKey);

      if (penaltyLevel && penaltyLevel > 0) {
        // Apply penalty delay
        const delay = penaltyLevel * 1000; // 1 second per penalty level

        logger.security('Penalty delay applied', {
          type: 'RATE_LIMIT_PENALTY_APPLIED',
          ip: req.ip,
          penaltyLevel,
          delay
        });

        setTimeout(() => proceed(), delay);
      } else {
        proceed();
      }
    } catch (error) {
      logger.error('Failed to check penalty:', error);
      proceed(); // Continue without penalty on error
    }
  }

  /**
   * Create dynamic rate limiter
   */
  createDynamicLimiter(options) {
    const defaultOptions = {
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: {
        error: 'Rate limit exceeded',
        retryAfter: Math.floor(options.windowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false
    };

    const mergedOptions = { ...defaultOptions, ...options };

    if (this.redisClient) {
      mergedOptions.store = new RedisStore({
        sendCommand: (...args) => this.redisClient.sendCommand(args)
      });
    }

    return rateLimit(mergedOptions);
  }

  /**
   * Get rate limiting analytics
   */
  getAnalytics() {
    const total = this.analytics.blocked + this.analytics.allowed;

    return {
      ...this.analytics,
      total,
      blockedPercentage: total > 0 ? Math.round((this.analytics.blocked / total) * 100) : 0,
      allowedPercentage: total > 0 ? Math.round((this.analytics.allowed / total) * 100) : 0,
      activeBypassTokens: this.bypassTokens.size,
      activeLimiters: this.limiters.size,
      customRules: this.customRules.size
    };
  }

  /**
   * Clear rate limiting data for specific IP (admin function)
   */
  async clearRateLimit(ip, type = null) {
    try {
      if (this.redisClient) {
        const pattern = type ? `*${ip}*${type}*` : `*${ip}*`;
        const keys = await this.redisClient.keys(pattern);

        if (keys.length > 0) {
          await this.redisClient.del(keys);
        }
      }

      // Clear penalties
      await cacheService.delete(`penalty:${ip}`);

      // Clear violations
      if (type) {
        await cacheService.delete(`violations:${ip}:${type}`);
      } else {
        // Clear all violation types for this IP
        const violationTypes = ['api', 'auth', 'register', 'passwordReset', 'upload', 'heavy'];
        for (const vType of violationTypes) {
          await cacheService.delete(`violations:${ip}:${vType}`);
        }
      }

      logger.info('Rate limit data cleared', { ip, type });
      return true;
    } catch (error) {
      logger.error('Failed to clear rate limit data:', error);
      return false;
    }
  }

  /**
   * Add bypass token
   */
  addBypassToken(token) {
    this.bypassTokens.add(token);
    logger.info('Bypass token added', { tokenLength: token.length });
  }

  /**
   * Remove bypass token
   */
  removeBypassToken(token) {
    const removed = this.bypassTokens.delete(token);
    if (removed) {
      logger.info('Bypass token removed', { tokenLength: token.length });
    }
    return removed;
  }

  /**
   * Get rate limit status for IP
   */
  async getRateLimitStatus(ip) {
    try {
      const status = {};

      // Check penalties
      const penaltyLevel = await cacheService.get(`penalty:${ip}`);
      if (penaltyLevel) {
        status.penalty = { level: penaltyLevel };
      }

      // Check violations for each type
      const violationTypes = ['api', 'auth', 'register', 'passwordReset', 'upload', 'heavy'];
      status.violations = {};

      for (const type of violationTypes) {
        const violations = await cacheService.get(`violations:${ip}:${type}`);
        if (violations) {
          status.violations[type] = violations;
        }
      }

      // If Redis is available, get current limits
      if (this.redisClient) {
        const keys = await this.redisClient.keys(`*${ip}*`);
        status.activeRateLimits = keys.length;
      }

      return status;
    } catch (error) {
      logger.error('Failed to get rate limit status:', error);
      return { error: error.message };
    }
  }
}

// Export singleton instance
const advancedRateLimitService = new AdvancedRateLimitService();

module.exports = advancedRateLimitService;
