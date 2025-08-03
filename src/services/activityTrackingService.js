const logger = require('../utils/logger');
const cacheService = require('./cacheService');

class ActivityTrackingService {
  constructor() {
    this.activeUsers = new Map(); // In-memory for fast access
    this.userSockets = new Map(); // Track socket connections
    this.activityTimeouts = new Map(); // Timeout handlers
    this.config = {
      onlineThreshold: 5 * 60 * 1000, // 5 minutes
      awayThreshold: 30 * 60 * 1000, // 30 minutes
      offlineAfter: 60 * 60 * 1000, // 1 hour
      updateInterval: 30 * 1000, // 30 seconds
      maxLastSeenHistory: 100
    };
  }

  /**
   * Initialize activity tracking service
   */
  async initialize() {
    try {
      // Load recent activity from cache
      await this.loadRecentActivity();

      // Setup periodic cleanup
      setInterval(
        () => {
          this.cleanupInactiveUsers();
        },
        5 * 60 * 1000
      ); // Every 5 minutes

      // Setup activity persistence
      setInterval(() => {
        this.persistActivityData();
      }, this.config.updateInterval);

      logger.info('Activity tracking service initialized');
    } catch (error) {
      logger.error('Activity tracking initialization failed:', error);
    }
  }

  /**
   * Track user online status
   */
  async setUserOnline(userId, socketId = null, metadata = {}) {
    try {
      const now = Date.now();
      const activityData = {
        userId,
        status: 'online',
        lastSeen: now,
        lastActivity: now,
        socketId,
        metadata: {
          userAgent: metadata.userAgent || '',
          ip: metadata.ip || '',
          platform: metadata.platform || '',
          ...metadata
        }
      };

      // Store in memory for fast access
      this.activeUsers.set(userId, activityData);

      // Track socket connection
      if (socketId) {
        this.userSockets.set(socketId, userId);
      }

      // Clear any existing timeout
      if (this.activityTimeouts.has(userId)) {
        clearTimeout(this.activityTimeouts.get(userId));
      }

      // Set timeout for auto-offline
      const timeout = setTimeout(() => {
        this.setUserOffline(userId);
      }, this.config.offlineAfter);

      this.activityTimeouts.set(userId, timeout);

      // Store in cache for persistence
      await cacheService.set(`user_activity:${userId}`, activityData, 24 * 60 * 60); // 24 hours

      // Add to active users list
      await this.addToActiveUsersList(userId);

      logger.debug('User set online', {
        userId,
        socketId,
        platform: metadata.platform
      });

      // Notify friends about status change
      await this.notifyStatusChange(userId, 'online');

      return activityData;
    } catch (error) {
      logger.error('Failed to set user online:', error);
      return null;
    }
  }

  /**
   * Track user offline status
   */
  async setUserOffline(userId, reason = 'disconnect') {
    try {
      const now = Date.now();
      const existingActivity = this.activeUsers.get(userId);

      const activityData = {
        userId,
        status: 'offline',
        lastSeen: now,
        lastActivity: existingActivity?.lastActivity || now,
        offlineReason: reason,
        sessionDuration: existingActivity ? now - existingActivity.lastActivity : 0
      };

      // Remove from active users
      this.activeUsers.delete(userId);

      // Clear timeout
      if (this.activityTimeouts.has(userId)) {
        clearTimeout(this.activityTimeouts.get(userId));
        this.activityTimeouts.delete(userId);
      }

      // Update cache
      await cacheService.set(`user_activity:${userId}`, activityData, 24 * 60 * 60);

      // Remove from active users list
      await this.removeFromActiveUsersList(userId);

      // Store last seen history
      await this.updateLastSeenHistory(userId, now);

      logger.debug('User set offline', {
        userId,
        reason,
        sessionDuration: activityData.sessionDuration
      });

      // Notify friends about status change
      await this.notifyStatusChange(userId, 'offline');

      return activityData;
    } catch (error) {
      logger.error('Failed to set user offline:', error);
      return null;
    }
  }

  /**
   * Update user activity (heartbeat)
   */
  async updateUserActivity(userId, activity = {}) {
    try {
      const existingActivity = this.activeUsers.get(userId);
      if (!existingActivity) {
        // User not tracked as online, set them online
        return await this.setUserOnline(userId, null, activity);
      }

      const now = Date.now();
      existingActivity.lastActivity = now;
      existingActivity.lastSeen = now;

      // Update activity type if provided
      if (activity.type) {
        existingActivity.currentActivity = activity.type;
      }

      // Update location if provided
      if (activity.page) {
        existingActivity.currentPage = activity.page;
      }

      // Reset timeout
      if (this.activityTimeouts.has(userId)) {
        clearTimeout(this.activityTimeouts.get(userId));
      }

      const timeout = setTimeout(() => {
        this.setUserOffline(userId, 'timeout');
      }, this.config.offlineAfter);

      this.activityTimeouts.set(userId, timeout);

      // Update cache
      await cacheService.set(`user_activity:${userId}`, existingActivity, 24 * 60 * 60);

      return existingActivity;
    } catch (error) {
      logger.error('Failed to update user activity:', error);
      return null;
    }
  }

  /**
   * Get user activity status
   */
  async getUserActivity(userId) {
    try {
      // Check memory first for active users
      const memoryActivity = this.activeUsers.get(userId);
      if (memoryActivity) {
        return this.enrichActivityData(memoryActivity);
      }

      // Check cache for recent activity
      const cachedActivity = await cacheService.get(`user_activity:${userId}`);
      if (cachedActivity) {
        return this.enrichActivityData(cachedActivity);
      }

      // Return default offline status
      return {
        userId,
        status: 'offline',
        lastSeen: null,
        statusText: 'Offline',
        isOnline: false,
        isAway: false
      };
    } catch (error) {
      logger.error('Failed to get user activity:', error);
      return null;
    }
  }

  /**
   * Get multiple users' activity status
   */
  async getMultipleUsersActivity(userIds) {
    try {
      const activities = {};

      for (const userId of userIds) {
        activities[userId] = await this.getUserActivity(userId);
      }

      return activities;
    } catch (error) {
      logger.error('Failed to get multiple users activity:', error);
      return {};
    }
  }

  /**
   * Get online friends for a user
   */
  async getOnlineFriends(userId, friendIds) {
    try {
      const onlineFriends = [];

      for (const friendId of friendIds) {
        const activity = await this.getUserActivity(friendId);
        if (activity && activity.isOnline) {
          onlineFriends.push({
            userId: friendId,
            ...activity
          });
        }
      }

      // Sort by last activity
      onlineFriends.sort((a, b) => b.lastActivity - a.lastActivity);

      return onlineFriends;
    } catch (error) {
      logger.error('Failed to get online friends:', error);
      return [];
    }
  }

  /**
   * Get currently active users (for admin)
   */
  getActiveUsers() {
    const activeUsers = [];

    for (const [userId, activity] of this.activeUsers.entries()) {
      activeUsers.push({
        userId,
        ...this.enrichActivityData(activity)
      });
    }

    // Sort by last activity
    return activeUsers.sort((a, b) => b.lastActivity - a.lastActivity);
  }

  /**
   * Enrich activity data with computed fields
   */
  enrichActivityData(activity) {
    const now = Date.now();
    const timeSinceLastSeen = now - (activity.lastSeen || 0);
    const timeSinceLastActivity = now - (activity.lastActivity || 0);

    let status = activity.status || 'offline';
    let statusText = 'Offline';
    let isOnline = false;
    let isAway = false;

    if (status === 'online' || timeSinceLastActivity < this.config.onlineThreshold) {
      isOnline = true;
      if (timeSinceLastActivity < this.config.onlineThreshold) {
        statusText = 'Online';
      } else if (timeSinceLastActivity < this.config.awayThreshold) {
        statusText = 'Away';
        isAway = true;
      } else {
        statusText = 'Last seen recently';
      }
    } else {
      // Format last seen time
      statusText = this.formatLastSeen(activity.lastSeen);
    }

    return {
      ...activity,
      statusText,
      isOnline,
      isAway,
      timeSinceLastSeen,
      timeSinceLastActivity
    };
  }

  /**
   * Format last seen time
   */
  formatLastSeen(lastSeen) {
    if (!lastSeen) return 'Never seen';

    const now = Date.now();
    const diff = now - lastSeen;

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;

    return new Date(lastSeen).toLocaleDateString();
  }

  /**
   * Handle socket disconnect
   */
  async handleSocketDisconnect(socketId) {
    try {
      const userId = this.userSockets.get(socketId);
      if (userId) {
        this.userSockets.delete(socketId);

        // Check if user has other active sockets
        const hasOtherSockets = Array.from(this.userSockets.values()).includes(userId);

        if (!hasOtherSockets) {
          await this.setUserOffline(userId, 'socket_disconnect');
        }
      }
    } catch (error) {
      logger.error('Failed to handle socket disconnect:', error);
    }
  }

  /**
   * Add user to active users list
   */
  async addToActiveUsersList(userId) {
    try {
      const activeUsersList = (await cacheService.get('active_users_list')) || [];
      if (!activeUsersList.includes(userId)) {
        activeUsersList.push(userId);
        // Keep only recent 1000 users
        if (activeUsersList.length > 1000) {
          activeUsersList.shift();
        }
        await cacheService.set('active_users_list', activeUsersList, 60 * 60); // 1 hour
      }
    } catch (error) {
      logger.error('Failed to add to active users list:', error);
    }
  }

  /**
   * Remove user from active users list
   */
  async removeFromActiveUsersList(userId) {
    try {
      const activeUsersList = (await cacheService.get('active_users_list')) || [];
      const index = activeUsersList.indexOf(userId);
      if (index > -1) {
        activeUsersList.splice(index, 1);
        await cacheService.set('active_users_list', activeUsersList, 60 * 60);
      }
    } catch (error) {
      logger.error('Failed to remove from active users list:', error);
    }
  }

  /**
   * Update last seen history
   */
  async updateLastSeenHistory(userId, timestamp) {
    try {
      const historyKey = `last_seen_history:${userId}`;
      const history = (await cacheService.get(historyKey)) || [];

      history.push(timestamp);

      // Keep only recent history
      if (history.length > this.config.maxLastSeenHistory) {
        history.splice(0, history.length - this.config.maxLastSeenHistory);
      }

      await cacheService.set(historyKey, history, 30 * 24 * 60 * 60); // 30 days
    } catch (error) {
      logger.error('Failed to update last seen history:', error);
    }
  }

  /**
   * Notify friends about status change
   */
  async notifyStatusChange(userId, status) {
    try {
      // This would integrate with your socket service
      // For now, we'll just log the event
      logger.debug('User status changed', {
        userId,
        status,
        timestamp: Date.now()
      });

      // Store status change event
      await cacheService.set(
        `status_change:${userId}:${Date.now()}`,
        { userId, status, timestamp: Date.now() },
        24 * 60 * 60 // 24 hours
      );
    } catch (error) {
      logger.error('Failed to notify status change:', error);
    }
  }

  /**
   * Load recent activity from cache
   */
  async loadRecentActivity() {
    try {
      const activeUsersList = (await cacheService.get('active_users_list')) || [];

      for (const userId of activeUsersList) {
        const activity = await cacheService.get(`user_activity:${userId}`);
        if (activity && activity.status === 'online') {
          // Check if still should be online
          const timeSinceLastActivity = Date.now() - activity.lastActivity;
          if (timeSinceLastActivity < this.config.offlineAfter) {
            this.activeUsers.set(userId, activity);
          }
        }
      }

      logger.debug(`Loaded ${this.activeUsers.size} active users from cache`);
    } catch (error) {
      logger.error('Failed to load recent activity:', error);
    }
  }

  /**
   * Cleanup inactive users
   */
  cleanupInactiveUsers() {
    const now = Date.now();
    const usersToRemove = [];

    for (const [userId, activity] of this.activeUsers.entries()) {
      const timeSinceLastActivity = now - activity.lastActivity;

      if (timeSinceLastActivity > this.config.offlineAfter) {
        usersToRemove.push(userId);
      }
    }

    for (const userId of usersToRemove) {
      this.setUserOffline(userId, 'cleanup');
    }

    if (usersToRemove.length > 0) {
      logger.debug(`Cleaned up ${usersToRemove.length} inactive users`);
    }
  }

  /**
   * Persist activity data to cache
   */
  async persistActivityData() {
    try {
      const activeUserIds = Array.from(this.activeUsers.keys());
      await cacheService.set('active_users_list', activeUserIds, 60 * 60);

      // Update activity statistics
      const stats = {
        totalActiveUsers: this.activeUsers.size,
        totalSockets: this.userSockets.size,
        lastUpdated: Date.now()
      };

      await cacheService.set('activity_stats', stats, 5 * 60); // 5 minutes
    } catch (error) {
      logger.error('Failed to persist activity data:', error);
    }
  }

  /**
   * Get activity statistics
   */
  async getActivityStats() {
    try {
      const stats = (await cacheService.get('activity_stats')) || {};

      return {
        ...stats,
        currentActiveUsers: this.activeUsers.size,
        currentSockets: this.userSockets.size,
        memoryUsage: {
          activeUsers: this.activeUsers.size,
          userSockets: this.userSockets.size,
          activityTimeouts: this.activityTimeouts.size
        }
      };
    } catch (error) {
      logger.error('Failed to get activity stats:', error);
      return {};
    }
  }

  /**
   * Set custom user status
   */
  async setCustomStatus(userId, statusMessage, emoji = null) {
    try {
      const activity = this.activeUsers.get(userId) || (await this.getUserActivity(userId));

      if (activity) {
        activity.customStatus = {
          message: statusMessage,
          emoji,
          timestamp: Date.now()
        };

        this.activeUsers.set(userId, activity);
        await cacheService.set(`user_activity:${userId}`, activity, 24 * 60 * 60);

        logger.debug('Custom status set', { userId, statusMessage, emoji });

        // Notify friends about status change
        await this.notifyStatusChange(userId, 'status_updated');
      }
    } catch (error) {
      logger.error('Failed to set custom status:', error);
    }
  }

  /**
   * Clear custom user status
   */
  async clearCustomStatus(userId) {
    try {
      const activity = this.activeUsers.get(userId);

      if (activity && activity.customStatus) {
        delete activity.customStatus;
        this.activeUsers.set(userId, activity);
        await cacheService.set(`user_activity:${userId}`, activity, 24 * 60 * 60);

        logger.debug('Custom status cleared', { userId });

        // Notify friends about status change
        await this.notifyStatusChange(userId, 'status_cleared');
      }
    } catch (error) {
      logger.error('Failed to clear custom status:', error);
    }
  }
}

// Export singleton instance
const activityTrackingService = new ActivityTrackingService();

module.exports = activityTrackingService;
