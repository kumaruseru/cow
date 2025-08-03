const express = require('express');
const {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  getFriends,
  getFriendRequestsReceived,
  getFriendRequestsSent,
  getFriendSuggestions,
  getFriendshipStatus
} = require('../controllers/friendController');

const { protect } = require('../middleware/auth');
const { checkAccountStatus } = require('../middleware/security');
const {
  validateParams,
  validateQuery,
  objectIdValidation,
  paginationValidation
} = require('../validation/validators');

const router = express.Router();

// All routes require authentication
router.use(protect);
router.use(checkAccountStatus);

// Friend management
router.get('/', validateQuery(paginationValidation), getFriends);

router.delete('/:userId', validateParams({ userId: objectIdValidation }), removeFriend);

// Friend requests
router.post('/request/:userId', validateParams({ userId: objectIdValidation }), sendFriendRequest);

router.post('/accept/:userId', validateParams({ userId: objectIdValidation }), acceptFriendRequest);

router.post('/reject/:userId', validateParams({ userId: objectIdValidation }), rejectFriendRequest);

// Get friend requests
router.get('/requests/received', validateQuery(paginationValidation), getFriendRequestsReceived);

router.get('/requests/sent', validateQuery(paginationValidation), getFriendRequestsSent);

// Friend suggestions and status
router.get('/suggestions', getFriendSuggestions);

router.get('/status/:userId', validateParams({ userId: objectIdValidation }), getFriendshipStatus);

module.exports = router;
