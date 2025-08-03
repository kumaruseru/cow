const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const messageStatusService = require('../services/messageStatusService');
const authMiddleware = require('../middleware/authMiddleware');
const { validationResult, body, param, query } = require('express-validator');
const logger = require('../utils/logger');

// Apply authentication to all routes
router.use(authMiddleware);

/**
 * @route   GET /api/message-status/:messageId
 * @desc    Get status of a specific message
 * @access  Private
 */
router.get('/:messageId', [
  param('messageId').isMongoId().withMessage('Invalid message ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { messageId } = req.params;
    const userId = req.user.id;

    // Check if user has access to this message
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    if (!message.canUserView(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get detailed status from service
    const status = await messageStatusService.getMessageStatus(messageId);
    
    if (!status) {
      // Fallback to message model data
      const statusInfo = message.getStatusInfo();
      return res.json({
        success: true,
        data: statusInfo
      });
    }

    res.json({
      success: true,
      data: {
        messageId: status.messageId,
        status: status.status,
        sent: status.sent,
        delivered: status.delivered,
        read: status.read,
        readBy: status.readBy,
        deliveryAttempts: status.attempts || 0,
        failureReason: status.failureReason,
        timings: {
          deliveryTime: status.delivered ? status.delivered - status.sent : null,
          readTime: status.read ? status.read - status.sent : null
        },
        metadata: status.metadata
      }
    });

  } catch (error) {
    logger.error('Error getting message status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/message-status/:messageId/delivered
 * @desc    Mark message as delivered
 * @access  Private
 */
router.put('/:messageId/delivered', [
  param('messageId').isMongoId().withMessage('Invalid message ID'),
  body('deliveredAt').optional().isISO8601().withMessage('Invalid delivery timestamp'),
  body('metadata').optional().isObject().withMessage('Metadata must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { messageId } = req.params;
    const { deliveredAt, metadata = {} } = req.body;
    const userId = req.user.id;

    // Check message access
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Only recipient can mark as delivered
    if (message.recipient.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only recipient can mark message as delivered'
      });
    }

    // Mark as delivered in service
    const serviceStatus = await messageStatusService.markAsDelivered(
      messageId, 
      deliveredAt ? new Date(deliveredAt).getTime() : null
    );

    // Mark as delivered in message model
    await message.markAsDelivered(metadata);

    // Emit real-time update
    if (global.socketService) {
      global.socketService.emitToUser(message.sender.toString(), 'messageStatusUpdate', {
        messageId,
        status: 'delivered',
        deliveredAt: message.deliveredAt,
        recipientId: userId
      });
    }

    res.json({
      success: true,
      message: 'Message marked as delivered',
      data: {
        messageId,
        status: 'delivered',
        deliveredAt: message.deliveredAt,
        serviceStatus
      }
    });

  } catch (error) {
    logger.error('Error marking message as delivered:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/message-status/:messageId/read
 * @desc    Mark message as read
 * @access  Private
 */
router.put('/:messageId/read', [
  param('messageId').isMongoId().withMessage('Invalid message ID'),
  body('readAt').optional().isISO8601().withMessage('Invalid read timestamp'),
  body('deviceInfo').optional().isString().withMessage('Device info must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { messageId } = req.params;
    const { readAt, deviceInfo = 'unknown' } = req.body;
    const userId = req.user.id;

    // Check message access
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Only recipient can mark as read
    if (message.recipient.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only recipient can mark message as read'
      });
    }

    // Mark as read in service
    const serviceStatus = await messageStatusService.markAsRead(
      messageId,
      userId,
      readAt ? new Date(readAt).getTime() : null
    );

    // Mark as read in message model
    await message.markAsRead(userId, deviceInfo);

    // Emit real-time update
    if (global.socketService) {
      global.socketService.emitToUser(message.sender.toString(), 'messageStatusUpdate', {
        messageId,
        status: 'read',
        readAt: message.readAt,
        readBy: userId,
        deviceInfo
      });
    }

    res.json({
      success: true,
      message: 'Message marked as read',
      data: {
        messageId,
        status: 'read',
        readAt: message.readAt,
        readBy: userId,
        serviceStatus
      }
    });

  } catch (error) {
    logger.error('Error marking message as read:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/message-status/bulk/read
 * @desc    Mark multiple messages as read
 * @access  Private
 */
router.put('/bulk/read', [
  body('messageIds').isArray({ min: 1 }).withMessage('Message IDs array is required'),
  body('messageIds.*').isMongoId().withMessage('Invalid message ID'),
  body('readAt').optional().isISO8601().withMessage('Invalid read timestamp'),
  body('deviceInfo').optional().isString().withMessage('Device info must be a string'),
  body('chatId').optional().isMongoId().withMessage('Invalid chat ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { messageIds, readAt, deviceInfo = 'unknown', chatId } = req.body;
    const userId = req.user.id;

    const results = [];
    const failedMessageIds = [];
    const now = readAt ? new Date(readAt) : new Date();

    // Process each message
    for (const messageId of messageIds) {
      try {
        const message = await Message.findById(messageId);
        
        if (!message) {
          failedMessageIds.push({ messageId, reason: 'Message not found' });
          continue;
        }

        // Only recipient can mark as read
        if (message.recipient.toString() !== userId) {
          failedMessageIds.push({ messageId, reason: 'Access denied' });
          continue;
        }

        // Mark as read
        await message.markAsRead(userId, deviceInfo);
        
        results.push({
          messageId,
          status: 'read',
          readAt: message.readAt
        });

        // Emit real-time update
        if (global.socketService) {
          global.socketService.emitToUser(message.sender.toString(), 'messageStatusUpdate', {
            messageId,
            status: 'read',
            readAt: message.readAt,
            readBy: userId,
            deviceInfo
          });
        }

      } catch (error) {
        failedMessageIds.push({ messageId, reason: error.message });
      }
    }

    // Mark in service
    await messageStatusService.markMultipleAsRead(messageIds, userId, chatId);

    res.json({
      success: true,
      message: `Marked ${results.length} messages as read`,
      data: {
        successful: results,
        failed: failedMessageIds,
        counts: {
          total: messageIds.length,
          successful: results.length,
          failed: failedMessageIds.length
        }
      }
    });

  } catch (error) {
    logger.error('Error marking messages as read:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/message-status/bulk
 * @desc    Get status of multiple messages
 * @access  Private
 */
router.get('/bulk/status', [
  query('messageIds').notEmpty().withMessage('Message IDs are required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { messageIds } = req.query;
    const userId = req.user.id;

    // Parse messageIds (can be comma-separated string or array)
    const messageIdArray = Array.isArray(messageIds) 
      ? messageIds 
      : messageIds.split(',').map(id => id.trim());

    // Get statuses from service
    const statuses = await messageStatusService.getMultipleMessageStatuses(messageIdArray);

    // Get additional info from database
    const messages = await Message.find({
      _id: { $in: messageIdArray },
      $or: [
        { sender: userId },
        { recipient: userId }
      ]
    }).select('_id status sentAt deliveredAt readAt readReceipts deliveryAttempts failureReason');

    const result = {};

    // Combine service data with database data
    for (const message of messages) {
      const serviceStatus = statuses[message._id.toString()];
      const statusInfo = message.getStatusInfo();

      result[message._id.toString()] = {
        ...statusInfo,
        ...serviceStatus,
        // Use database data as primary source
        status: message.status,
        sentAt: message.sentAt,
        deliveredAt: message.deliveredAt,
        readAt: message.readAt
      };
    }

    res.json({
      success: true,
      data: result,
      metadata: {
        requested: messageIdArray.length,
        found: Object.keys(result).length
      }
    });

  } catch (error) {
    logger.error('Error getting bulk message statuses:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/message-status/conversation/:conversationId
 * @desc    Get message statuses for a conversation
 * @access  Private
 */
router.get('/conversation/:conversationId', [
  param('conversationId').notEmpty().withMessage('Conversation ID is required'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { conversationId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const userId = req.user.id;

    // Get messages from conversation
    const messages = await Message.find({
      conversationId,
      $or: [
        { sender: userId },
        { recipient: userId }
      ]
    })
    .select('_id status sentAt deliveredAt readAt readReceipts deliveryAttempts failureReason sender recipient')
    .sort({ createdAt: -1 })
    .skip(parseInt(offset))
    .limit(parseInt(limit));

    const messageStatuses = {};
    const unreadCount = messages.filter(m => 
      m.recipient.toString() === userId && m.status !== 'read'
    ).length;

    // Get status info for each message
    for (const message of messages) {
      messageStatuses[message._id.toString()] = message.getStatusInfo();
    }

    res.json({
      success: true,
      data: {
        conversationId,
        messageStatuses,
        metadata: {
          total: messages.length,
          unreadCount,
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      }
    });

  } catch (error) {
    logger.error('Error getting conversation message statuses:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/message-status/unread/count
 * @desc    Get unread message count
 * @access  Private
 */
router.get('/unread/count', [
  query('chatId').optional().isMongoId().withMessage('Invalid chat ID')
], async (req, res) => {
  try {
    const { chatId } = req.query;
    const userId = req.user.id;

    const unreadData = await messageStatusService.getUnreadCount(userId, chatId);

    res.json({
      success: true,
      data: unreadData
    });

  } catch (error) {
    logger.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/message-status/analytics
 * @desc    Get message status analytics
 * @access  Private
 */
router.get('/analytics', async (req, res) => {
  try {
    const analytics = messageStatusService.getStatusAnalytics();
    const deliveryReport = await messageStatusService.getDeliveryReport();

    res.json({
      success: true,
      data: {
        analytics,
        deliveryReport,
        timestamp: Date.now()
      }
    });

  } catch (error) {
    logger.error('Error getting message status analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/message-status/delivery-report
 * @desc    Get delivery report
 * @access  Private
 */
router.get('/delivery-report', [
  query('timeRange').optional().isInt({ min: 3600000 }).withMessage('Time range must be at least 1 hour in milliseconds')
], async (req, res) => {
  try {
    const { timeRange } = req.query;
    const report = await messageStatusService.getDeliveryReport(
      timeRange ? parseInt(timeRange) : undefined
    );

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    logger.error('Error getting delivery report:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/message-status/:messageId/failed
 * @desc    Mark message as failed (for system use)
 * @access  Private
 */
router.put('/:messageId/failed', [
  param('messageId').isMongoId().withMessage('Invalid message ID'),
  body('reason').notEmpty().withMessage('Failure reason is required'),
  body('metadata').optional().isObject().withMessage('Metadata must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { messageId } = req.params;
    const { reason, metadata = {} } = req.body;
    const userId = req.user.id;

    // Check message access
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Only sender can mark as failed
    if (message.sender.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only sender can mark message as failed'
      });
    }

    // Mark as failed in service
    await messageStatusService.markAsDeliveryFailed(messageId, reason);

    // Mark as failed in message model
    await message.markAsFailed(reason, metadata);

    res.json({
      success: true,
      message: 'Message marked as failed',
      data: {
        messageId,
        status: 'failed',
        reason,
        failedAt: new Date()
      }
    });

  } catch (error) {
    logger.error('Error marking message as failed:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;
