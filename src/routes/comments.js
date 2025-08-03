const express = require('express');
const {
  createComment,
  getCommentsByPost,
  updateComment,
  deleteComment,
  toggleCommentLike,
  replyToComment,
  reportComment
} = require('../controllers/commentController');

const { protect, optionalAuth } = require('../middleware/auth');
const { checkAccountStatus } = require('../middleware/security');
const {
  validateBody,
  validateParams,
  createCommentValidation,
  objectIdValidation
} = require('../validation/validators');

const router = express.Router();

// Public routes
router.get(
  '/post/:postId',
  optionalAuth,
  validateParams({ postId: objectIdValidation }),
  getCommentsByPost
);

// Protected routes
router.use(protect);
router.use(checkAccountStatus);

// Comment CRUD
router.post(
  '/post/:postId',
  validateParams({ postId: objectIdValidation }),
  validateBody(createCommentValidation),
  createComment
);

router.put(
  '/:commentId',
  validateParams({ commentId: objectIdValidation }),
  validateBody(createCommentValidation),
  updateComment
);

router.delete('/:commentId', validateParams({ commentId: objectIdValidation }), deleteComment);

// Comment interactions
router.post(
  '/:commentId/like',
  validateParams({ commentId: objectIdValidation }),
  toggleCommentLike
);

router.post(
  '/:commentId/reply',
  validateParams({ commentId: objectIdValidation }),
  validateBody(createCommentValidation),
  replyToComment
);

router.post('/:commentId/report', validateParams({ commentId: objectIdValidation }), reportComment);

module.exports = router;
