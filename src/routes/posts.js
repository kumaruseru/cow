const express = require('express');
const {
  createPost,
  getPosts,
  getTrendingPosts,
  getPostsByUser,
  getPost,
  updatePost,
  deletePost,
  toggleLike,
  sharePost,
  reportPost
} = require('../controllers/postController');

const { protect, optionalAuth } = require('../middleware/auth');
const { checkAccountStatus } = require('../middleware/security');
const {
  validateBody,
  validateParams,
  validateQuery,
  createPostValidation,
  objectIdValidation,
  paginationValidation
} = require('../validation/validators');

const router = express.Router();

// Public routes (with optional auth)
router.get('/trending', optionalAuth, validateQuery(paginationValidation), getTrendingPosts);

router.get('/:postId', optionalAuth, validateParams({ postId: objectIdValidation }), getPost);

// Protected routes
router.use(protect);

router
  .route('/')
  .post(validateBody(createPostValidation), createPost)
  .get(validateQuery(paginationValidation), getPosts);

router.get(
  '/feed/timeline',
  validateQuery(paginationValidation),
  getPosts // Using getPosts with user feed logic
);

router.get(
  '/user/:userId',
  validateParams({ userId: objectIdValidation }),
  validateQuery(paginationValidation),
  getPostsByUser
);

router
  .route('/:postId')
  .put(
    validateParams({ postId: objectIdValidation }),
    validateBody(createPostValidation),
    updatePost
  )
  .delete(validateParams({ postId: objectIdValidation }), deletePost);

// Post interactions
router.post('/:postId/like', validateParams({ postId: objectIdValidation }), toggleLike);

router.delete('/:postId/like', validateParams({ postId: objectIdValidation }), toggleLike);

router.post('/:postId/share', validateParams({ postId: objectIdValidation }), sharePost);

router.post('/:postId/report', validateParams({ postId: objectIdValidation }), reportPost);

module.exports = router;
