const redis = require('redis');
const logger = require('../utils/logger');

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxRetries = 5;
  }

  /**
   * Initialize Redis connection
   */
  async connect() {
    try {
      // Skip Redis connection in development if not available
      if (process.env.NODE_ENV === 'development' && !process.env.REDIS_URL) {
        logger.warn('Redis connection skipped in development mode');
        this.isConnected = false;
        return;
      }

      const redisConfig = {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        retry_strategy: options => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            logger.error('Redis server refused connection');
            return new Error('Redis server refused connection');
          }
          if (options.total_retry_time > 1000 * 60) {
            // Stop retrying after 1 minute
            logger.error('Redis retry time exhausted');
            return new Error('Retry time exhausted');
          }
          if (options.attempt > 3) {
            // Max 3 retries
            logger.error('Redis max retries exceeded');
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      };

      this.client = redis.createClient(redisConfig);

      // Event handlers
      this.client.on('connect', () => {
        logger.info('Redis client connected');
        this.isConnected = true;
        this.connectionAttempts = 0;
      });

      this.client.on('error', err => {
        logger.warn('Redis client error (fallback mode active):', {
          code: err.code,
          message: err.message
        });
        this.isConnected = false;

        // Don't spam logs in development
        if (process.env.NODE_ENV === 'development') {
          setTimeout(() => {
            this.client.removeAllListeners('error');
          }, 1000);
        }
      });

      this.client.on('end', () => {
        logger.warn('Redis client disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
      logger.info('Redis cache service initialized successfully');
    } catch (error) {
      logger.warn('Failed to connect to Redis (fallback mode active):', {
        message: error.message
      });
      this.isConnected = false;
    }
  }

  /**
   * Set cache value with TTL
   */
  async set(key, value, ttl = 3600) {
    try {
      if (!this.isConnected) {
        logger.debug('Cache not available, skipping set operation');
        return false;
      }

      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      await this.client.setEx(key, ttl, serializedValue);

      logger.debug('Cache set', { key, ttl });
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Get cache value
   */
  async get(key) {
    try {
      if (!this.isConnected) {
        logger.debug('Cache not available, skipping get operation');
        return null;
      }

      const value = await this.client.get(key);
      if (!value) return null;

      try {
        const parsed = JSON.parse(value);
        logger.debug('Cache hit', { key });
        return parsed;
      } catch {
        logger.debug('Cache hit (string)', { key });
        return value;
      }
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Delete cache key
   */
  async del(key) {
    try {
      if (!this.isConnected) return false;

      await this.client.del(key);
      logger.debug('Cache deleted', { key });
      return true;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Delete multiple cache keys by pattern
   */
  async delPattern(pattern) {
    try {
      if (!this.isConnected) return false;

      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        logger.debug('Cache pattern deleted', { pattern, count: keys.length });
      }
      return true;
    } catch (error) {
      logger.error('Cache pattern delete error:', error);
      return false;
    }
  }

  /**
   * Increment counter
   */
  async incr(key, ttl = 3600) {
    try {
      if (!this.isConnected) return 0;

      const value = await this.client.incr(key);
      if (value === 1) {
        await this.client.expire(key, ttl);
      }

      logger.debug('Cache incremented', { key, value });
      return value;
    } catch (error) {
      logger.error('Cache increment error:', error);
      return 0;
    }
  }

  /**
   * Rate limiting check
   */
  async rateLimit(key, limit, window) {
    try {
      if (!this.isConnected) return { allowed: true, remaining: limit };

      const current = await this.incr(key, window);
      const remaining = Math.max(0, limit - current);

      return {
        allowed: current <= limit,
        remaining,
        total: limit,
        resetTime: Date.now() + window * 1000
      };
    } catch (error) {
      logger.error('Rate limit check error:', error);
      return { allowed: true, remaining: limit };
    }
  }

  /**
   * Store session data
   */
  async setSession(sessionId, data, ttl = 86400) {
    return this.set(`session:${sessionId}`, data, ttl);
  }

  /**
   * Get session data
   */
  async getSession(sessionId) {
    return this.get(`session:${sessionId}`);
  }

  /**
   * Delete session
   */
  async delSession(sessionId) {
    return this.del(`session:${sessionId}`);
  }

  /**
   * Store user cache
   */
  async setUser(userId, userData, ttl = 1800) {
    return this.set(`user:${userId}`, userData, ttl);
  }

  /**
   * Get user cache
   */
  async getUser(userId) {
    return this.get(`user:${userId}`);
  }

  /**
   * Cache posts for feed
   */
  async setFeed(userId, posts, ttl = 300) {
    return this.set(`feed:${userId}`, posts, ttl);
  }

  /**
   * Get cached feed
   */
  async getFeed(userId) {
    return this.get(`feed:${userId}`);
  }

  /**
   * Clear user-related caches
   */
  async clearUserCaches(userId) {
    await this.delPattern(`user:${userId}*`);
    await this.delPattern(`feed:${userId}*`);
    await this.delPattern(`session:*${userId}*`);
  }

  /**
   * Get cache statistics (fast version)
   */
  async getStats() {
    try {
      if (!this.isConnected) {
        return {
          connected: false,
          mode: 'fallback',
          memory: 'N/A',
          keys: 0
        };
      }

      // Quick stats without detailed memory info for speed
      const dbSize = await Promise.race([
        this.client.dbSize(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
      ]);

      return {
        connected: true,
        mode: 'redis',
        keys: dbSize,
        memory: 'Redis connected'
      };
    } catch (error) {
      logger.debug('Cache stats error (using fallback):', error.message);
      return {
        connected: false,
        mode: 'fallback',
        error: error.message
      };
    }
  } /**
   * Parse Redis memory info
   */
  parseMemoryInfo(info) {
    const lines = info.split('\r\n');
    const memoryInfo = {};

    lines.forEach(line => {
      if (line.includes('used_memory_human')) {
        memoryInfo.used = line.split(':')[1];
      }
      if (line.includes('used_memory_peak_human')) {
        memoryInfo.peak = line.split(':')[1];
      }
    });

    return memoryInfo;
  }

  /**
   * Graceful shutdown
   */
  async disconnect() {
    try {
      if (this.client && this.isConnected) {
        await this.client.disconnect();
        logger.info('Redis client disconnected gracefully');
      }
    } catch (error) {
      logger.error('Error disconnecting Redis:', error);
    }
  }
}

// Export singleton instance
const cacheService = new CacheService();

module.exports = cacheService;
