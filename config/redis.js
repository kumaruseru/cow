
// Redis configuration with fallback
const redis = require('redis');

let redisClient = null;

const createRedisClient = () => {
  if (!process.env.REDIS_URL) {
    console.log('⚠️ Redis URL not configured, using memory store for rate limiting');
    return null;
  }

  try {
    const client = redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.log('❌ Redis: Too many reconnection attempts, giving up');
            return new Error('Too many reconnection attempts');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    client.on('error', (err) => {
      console.log('⚠️ Redis connection error (falling back to memory store):', err.message);
    });

    client.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    client.on('disconnect', () => {
      console.log('⚠️ Redis disconnected');
    });

    return client;
  } catch (error) {
    console.log('⚠️ Redis setup failed, using memory store:', error.message);
    return null;
  }
};

module.exports = {
  createRedisClient,
  getRedisClient: () => redisClient
};