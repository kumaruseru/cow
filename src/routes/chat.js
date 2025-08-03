const express = require('express');
const { protect } = require('../middleware/auth');
const {
  validateBody,
  validateParams,
  messageValidation,
  objectIdValidation
} = require('../validation/validators');

const router = express.Router();

// Placeholder controller functions
const chatController = {
  getConversations: (req, res) => res.json({ message: 'Get conversations' }),
  getConversation: (req, res) => res.json({ message: 'Get conversation' }),
  sendMessage: (req, res) => res.json({ message: 'Send message' }),
  getMessages: (req, res) => res.json({ message: 'Get messages' }),
  markAsRead: (req, res) => res.json({ message: 'Mark as read' }),
  deleteMessage: (req, res) => res.json({ message: 'Delete message' }),
  deleteConversation: (req, res) => res.json({ message: 'Delete conversation' }),
  searchMessages: (req, res) => res.json({ message: 'Search messages' })
};

// All routes require authentication
router.use(protect);

// Conversation routes
router.get('/', chatController.getConversations);

router
  .route('/:userId')
  .get(validateParams({ userId: objectIdValidation }), chatController.getConversation)
  .post(
    validateParams({ userId: objectIdValidation }),
    validateBody(messageValidation),
    chatController.sendMessage
  )
  .delete(validateParams({ userId: objectIdValidation }), chatController.deleteConversation);

// Message routes
router.get(
  '/:userId/messages',
  validateParams({ userId: objectIdValidation }),
  chatController.getMessages
);

router.put(
  '/:userId/read',
  validateParams({ userId: objectIdValidation }),
  chatController.markAsRead
);

router.delete(
  '/message/:messageId',
  validateParams({ messageId: objectIdValidation }),
  chatController.deleteMessage
);

router.get('/search/:query', chatController.searchMessages);

module.exports = router;
