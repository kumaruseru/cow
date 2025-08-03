const mongoose = require('mongoose');
const logger = require('../utils/logger');

class DatabaseOptimizationService {
  constructor() {
    this.slowQueryThreshold = 100; // 100ms
    this.queryStats = new Map();
    this.indexAnalytics = new Map();
  }

  /**
   * Initialize database optimization monitoring
   */
  async initialize() {
    try {
      // Enable query profiling in development
      if (process.env.NODE_ENV === 'development') {
        await this.enableQueryProfiling();
      }

      // Set up query monitoring
      this.setupQueryMonitoring();

      // Analyze existing indexes
      await this.analyzeIndexes();

      logger.info('Database optimization service initialized');
    } catch (error) {
      logger.error('Database optimization initialization failed:', error);
    }
  }

  /**
   * Enable MongoDB query profiling
   */
  async enableQueryProfiling() {
    try {
      const db = mongoose.connection.db;
      await db.command({ profile: 2, slowms: this.slowQueryThreshold });
      logger.info('MongoDB query profiling enabled');
    } catch (error) {
      logger.warn('Could not enable query profiling:', error.message);
    }
  }

  /**
   * Setup Mongoose query monitoring
   */
  setupQueryMonitoring() {
    // Monitor all queries
    mongoose.connection.on('query', query => {
      const startTime = Date.now();

      query.on('result', () => {
        const duration = Date.now() - startTime;
        this.trackQuery(query.op, query.collection, duration, query.filter);
      });
    });

    // Log slow queries
    mongoose.set('debug', (collectionName, method, query, doc) => {
      const startTime = Date.now();

      process.nextTick(() => {
        const duration = Date.now() - startTime;
        if (duration > this.slowQueryThreshold) {
          logger.warn('Slow database query detected', {
            collection: collectionName,
            method,
            duration: `${duration}ms`,
            query: JSON.stringify(query),
            doc: doc ? JSON.stringify(doc) : undefined
          });
        }
      });
    });
  }

  /**
   * Track query performance
   */
  trackQuery(operation, collection, duration, filter) {
    const key = `${collection}.${operation}`;

    if (!this.queryStats.has(key)) {
      this.queryStats.set(key, {
        count: 0,
        totalTime: 0,
        maxTime: 0,
        minTime: Infinity,
        avgTime: 0,
        slowQueries: 0
      });
    }

    const stats = this.queryStats.get(key);
    stats.count++;
    stats.totalTime += duration;
    stats.maxTime = Math.max(stats.maxTime, duration);
    stats.minTime = Math.min(stats.minTime, duration);
    stats.avgTime = stats.totalTime / stats.count;

    if (duration > this.slowQueryThreshold) {
      stats.slowQueries++;

      logger.performance.dbQuery(`${collection}.${operation}`, duration, {
        filter: JSON.stringify(filter),
        slowQueryCount: stats.slowQueries
      });
    }
  }

  /**
   * Analyze database indexes
   */
  async analyzeIndexes() {
    try {
      const db = mongoose.connection.db;
      const collections = await db.listCollections().toArray();

      for (const collectionInfo of collections) {
        const collectionName = collectionInfo.name;
        const collection = db.collection(collectionName);

        // Get index information
        const indexes = await collection.indexes();
        const stats = await collection.stats();

        this.indexAnalytics.set(collectionName, {
          indexes: indexes.length,
          indexDetails: indexes,
          documentCount: stats.count,
          avgDocSize: stats.avgObjSize,
          totalSize: stats.size,
          indexSize: stats.totalIndexSize
        });

        // Check for unused indexes (this requires query analysis)
        await this.checkIndexUsage(collectionName, indexes);
      }

      logger.info('Database index analysis completed', {
        collections: collections.length,
        totalIndexes: Array.from(this.indexAnalytics.values()).reduce(
          (sum, col) => sum + col.indexes,
          0
        )
      });
    } catch (error) {
      logger.error('Index analysis failed:', error);
    }
  }

  /**
   * Check index usage and suggest optimizations
   */
  async checkIndexUsage(collectionName, indexes) {
    try {
      const db = mongoose.connection.db;
      const collection = db.collection(collectionName);

      // Get index usage stats (MongoDB 3.2+)
      const indexStats = await collection.aggregate([{ $indexStats: {} }]).toArray();

      const recommendations = [];

      for (const index of indexes) {
        const indexName = index.name;
        const usage = indexStats.find(stat => stat.name === indexName);

        if (usage && usage.accesses.ops === 0 && indexName !== '_id_') {
          recommendations.push({
            type: 'UNUSED_INDEX',
            collection: collectionName,
            index: indexName,
            suggestion: `Consider dropping unused index: ${indexName}`
          });
        }

        // Check for redundant indexes
        if (this.isRedundantIndex(index, indexes)) {
          recommendations.push({
            type: 'REDUNDANT_INDEX',
            collection: collectionName,
            index: indexName,
            suggestion: `Index ${indexName} may be redundant`
          });
        }
      }

      if (recommendations.length > 0) {
        logger.info('Index optimization recommendations', {
          collection: collectionName,
          recommendations
        });
      }
    } catch (error) {
      logger.debug('Index usage check failed (normal for older MongoDB):', error.message);
    }
  }

  /**
   * Check if index is redundant
   */
  isRedundantIndex(index, allIndexes) {
    const indexKeys = Object.keys(index.key);

    // Skip _id index and single field indexes
    if (index.name === '_id_' || indexKeys.length === 1) {
      return false;
    }

    // Check if there's a compound index that starts with the same fields
    return allIndexes.some(otherIndex => {
      if (otherIndex.name === index.name) return false;

      const otherKeys = Object.keys(otherIndex.key);
      return (
        otherKeys.length > indexKeys.length && indexKeys.every((key, idx) => otherKeys[idx] === key)
      );
    });
  }

  /**
   * Get query performance statistics
   */
  getQueryStats() {
    const stats = {};

    for (const [key, data] of this.queryStats.entries()) {
      stats[key] = {
        ...data,
        avgTime: Math.round(data.avgTime * 100) / 100,
        slowQueryPercentage: Math.round((data.slowQueries / data.count) * 100)
      };
    }

    return {
      queryStats: stats,
      slowQueryThreshold: this.slowQueryThreshold,
      totalQueries: Array.from(this.queryStats.values()).reduce((sum, stat) => sum + stat.count, 0),
      totalSlowQueries: Array.from(this.queryStats.values()).reduce(
        (sum, stat) => sum + stat.slowQueries,
        0
      )
    };
  }

  /**
   * Get index analytics
   */
  getIndexAnalytics() {
    const analytics = {};

    for (const [collection, data] of this.indexAnalytics.entries()) {
      analytics[collection] = {
        indexCount: data.indexes,
        documentCount: data.documentCount,
        avgDocumentSize: data.avgDocSize,
        collectionSize: data.totalSize,
        indexSize: data.indexSize,
        indexSizeRatio: Math.round((data.indexSize / data.totalSize) * 100) || 0
      };
    }

    return analytics;
  }

  /**
   * Suggest query optimizations
   */
  async suggestOptimizations() {
    const suggestions = [];

    // Analyze slow queries
    for (const [operation, stats] of this.queryStats.entries()) {
      if (stats.slowQueryPercentage > 10) {
        suggestions.push({
          type: 'HIGH_SLOW_QUERY_RATE',
          operation,
          slowPercentage: stats.slowQueryPercentage,
          suggestion: `${operation} has ${stats.slowQueryPercentage}% slow queries. Consider adding indexes or optimizing queries.`
        });
      }

      if (stats.avgTime > this.slowQueryThreshold) {
        suggestions.push({
          type: 'HIGH_AVERAGE_TIME',
          operation,
          avgTime: stats.avgTime,
          suggestion: `${operation} average time is ${stats.avgTime}ms. Consider optimization.`
        });
      }
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed > 500 * 1024 * 1024) {
      // 500MB
      suggestions.push({
        type: 'HIGH_MEMORY_USAGE',
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        suggestion: 'High memory usage detected. Consider implementing pagination or data cleanup.'
      });
    }

    return suggestions;
  }

  /**
   * Create optimal indexes for common queries
   */
  async createOptimalIndexes() {
    try {
      const models = mongoose.modelNames();
      const recommendations = [];

      for (const modelName of models) {
        const Model = mongoose.model(modelName);
        const schema = Model.schema;
        const collection = Model.collection;

        // Analyze schema for potential indexes
        const fields = Object.keys(schema.paths);

        for (const field of fields) {
          const schemaType = schema.paths[field];

          // Suggest indexes for commonly queried fields
          if (field === 'email' || field === 'username') {
            recommendations.push({
              collection: collection.collectionName,
              index: { [field]: 1 },
              reason: 'Authentication field'
            });
          }

          if (field.includes('Date') || field === 'createdAt' || field === 'updatedAt') {
            recommendations.push({
              collection: collection.collectionName,
              index: { [field]: -1 },
              reason: 'Date-based queries'
            });
          }

          if (schemaType.instance === 'ObjectID' && field.endsWith('Id')) {
            recommendations.push({
              collection: collection.collectionName,
              index: { [field]: 1 },
              reason: 'Foreign key reference'
            });
          }
        }
      }

      logger.info('Index recommendations generated', {
        totalRecommendations: recommendations.length,
        recommendations
      });

      return recommendations;
    } catch (error) {
      logger.error('Failed to generate index recommendations:', error);
      return [];
    }
  }

  /**
   * Clean up old query stats
   */
  cleanupStats() {
    // Reset stats if they get too large
    if (this.queryStats.size > 1000) {
      this.queryStats.clear();
      logger.info('Query statistics cleared to prevent memory buildup');
    }
  }

  /**
   * Get database performance dashboard
   */
  async getPerformanceDashboard() {
    try {
      const queryStats = this.getQueryStats();
      const indexAnalytics = this.getIndexAnalytics();
      const suggestions = await this.suggestOptimizations();

      return {
        timestamp: new Date().toISOString(),
        database: {
          connectionState: mongoose.connection.readyState,
          host: mongoose.connection.host,
          name: mongoose.connection.name
        },
        performance: {
          queryStats,
          indexAnalytics,
          suggestions,
          memoryUsage: process.memoryUsage()
        }
      };
    } catch (error) {
      logger.error('Failed to generate performance dashboard:', error);
      return { error: error.message };
    }
  }
}

// Export singleton instance
const dbOptimizationService = new DatabaseOptimizationService();

module.exports = dbOptimizationService;
