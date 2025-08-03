const express = require('express');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Placeholder controller functions
const notificationController = {
  getNotifications: (req, res) => res.json({ message: 'Get notifications' }),
  markAsRead: (req, res) => res.json({ message: 'Mark notification as read' }),
  markAllAsRead: (req, res) => res.json({ message: 'Mark all notifications as read' }),
  deleteNotification: (req, res) => res.json({ message: 'Delete notification' }),
  getUnreadCount: (req, res) => res.json({ message: 'Get unread count' }),
  updateSettings: (req, res) => res.json({ message: 'Update notification settings' })
};

// All routes require authentication
router.use(protect);

router.get('/', notificationController.getNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.put('/read-all', notificationController.markAllAsRead);
router.put('/:notificationId/read', notificationController.markAsRead);
router.delete('/:notificationId', notificationController.deleteNotification);
router.put('/settings', notificationController.updateSettings);

module.exports = router;
