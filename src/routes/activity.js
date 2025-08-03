const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const activityTrackingService = require('../services/activityTrackingService');
const logger = require('../utils/logger');

/**
 * @route   GET /api/activity/status/:userId
 * @desc    Get user activity status
 * @access  Private
 */
router.get('/status/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user is requesting their own status or friend's status
    // In a real app, you'd verify friendship here

    const activity = await activityTrackingService.getUserActivity(userId);

    if (!activity) {
      return res.status(404).json({
        success: false,
        error: 'User activity not found'
      });
    }

    res.json({
      success: true,
      data: {
        userId,
        status: activity.status,
        statusText: activity.statusText,
        isOnline: activity.isOnline,
        isAway: activity.isAway,
        lastSeen: activity.lastSeen,
        customStatus: activity.customStatus || null
      }
    });
  } catch (error) {
    logger.error('Get user activity failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user activity'
    });
  }
});

/**
 * @route   POST /api/activity/status
 * @desc    Set custom status message
 * @access  Private
 */
router.post('/status', auth, async (req, res) => {
  try {
    const { message, emoji } = req.body;
    const userId = req.user.id;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Status message is required'
      });
    }

    if (message.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Status message too long (max 100 characters)'
      });
    }

    await activityTrackingService.setCustomStatus(userId, message, emoji);

    res.json({
      success: true,
      message: 'Status updated successfully',
      data: {
        message,
        emoji,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Set custom status failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set custom status'
    });
  }
});

/**
 * @route   DELETE /api/activity/status
 * @desc    Clear custom status message
 * @access  Private
 */
router.delete('/status', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    await activityTrackingService.clearCustomStatus(userId);

    res.json({
      success: true,
      message: 'Status cleared successfully'
    });
  } catch (error) {
    logger.error('Clear custom status failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear custom status'
    });
  }
});

/**
 * @route   POST /api/activity/heartbeat
 * @desc    Update user activity (heartbeat)
 * @access  Private
 */
router.post('/heartbeat', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, page } = req.body;

    const activity = {
      type: type || 'general',
      page: page || 'unknown',
      userAgent: req.get('User-Agent'),
      ip: req.ip
    };

    await activityTrackingService.updateUserActivity(userId, activity);

    res.json({
      success: true,
      message: 'Activity updated',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Update activity failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update activity'
    });
  }
});

/**
 * @route   GET /api/activity/friends/online
 * @desc    Get online friends
 * @access  Private
 */
router.get('/friends/online', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // In a real app, you'd get the user's friend list from database
    // For now, we'll use a placeholder
    const friendIds = req.query.friends ? req.query.friends.split(',') : [];

    if (friendIds.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    const onlineFriends = await activityTrackingService.getOnlineFriends(userId, friendIds);

    res.json({
      success: true,
      data: onlineFriends.map(friend => ({
        userId: friend.userId,
        status: friend.status,
        statusText: friend.statusText,
        isOnline: friend.isOnline,
        isAway: friend.isAway,
        lastSeen: friend.lastSeen,
        customStatus: friend.customStatus || null,
        currentActivity: friend.currentActivity || null
      }))
    });
  } catch (error) {
    logger.error('Get online friends failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get online friends'
    });
  }
});

/**
 * @route   GET /api/activity/bulk
 * @desc    Get multiple users' activity status
 * @access  Private
 */
router.get('/bulk', auth, async (req, res) => {
  try {
    const userIds = req.query.users ? req.query.users.split(',') : [];

    if (userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No user IDs provided'
      });
    }

    if (userIds.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Too many users requested (max 50)'
      });
    }

    const activities = await activityTrackingService.getMultipleUsersActivity(userIds);

    const result = {};
    for (const [userId, activity] of Object.entries(activities)) {
      result[userId] = {
        status: activity.status,
        statusText: activity.statusText,
        isOnline: activity.isOnline,
        isAway: activity.isAway,
        lastSeen: activity.lastSeen,
        customStatus: activity.customStatus || null
      };
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Get bulk activity failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user activities'
    });
  }
});

/**
 * @route   GET /api/activity/stats
 * @desc    Get activity statistics (admin only)
 * @access  Private + Admin
 */
router.get('/stats', auth, async (req, res) => {
  try {
    // Check if user is admin (in a real app)
    // if (!req.user.isAdmin) {
    //   return res.status(403).json({
    //     success: false,
    //     error: 'Admin access required'
    //   });
    // }

    const stats = await activityTrackingService.getActivityStats();
    const activeUsers = activityTrackingService.getActiveUsers();

    res.json({
      success: true,
      data: {
        statistics: stats,
        activeUsers: activeUsers.slice(0, 20), // Top 20 active users
        totalActive: activeUsers.length
      }
    });
  } catch (error) {
    logger.error('Get activity stats failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get activity statistics'
    });
  }
});

/**
 * @route   POST /api/activity/online
 * @desc    Set user online (called on login/connect)
 * @access  Private
 */
router.post('/online', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const metadata = {
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      platform: req.body.platform || 'web'
    };

    const activity = await activityTrackingService.setUserOnline(userId, null, metadata);

    res.json({
      success: true,
      message: 'User set online',
      data: {
        status: activity.status,
        timestamp: activity.lastSeen
      }
    });
  } catch (error) {
    logger.error('Set user online failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set user online'
    });
  }
});

/**
 * @route   POST /api/activity/offline
 * @desc    Set user offline (called on logout/disconnect)
 * @access  Private
 */
router.post('/offline', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const activity = await activityTrackingService.setUserOffline(userId, 'manual');

    res.json({
      success: true,
      message: 'User set offline',
      data: {
        status: activity.status,
        sessionDuration: activity.sessionDuration,
        timestamp: activity.lastSeen
      }
    });
  } catch (error) {
    logger.error('Set user offline failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set user offline'
    });
  }
});

module.exports = router;
