const express = require('express');
const {
  getProfile,
  updateProfile,
  updatePrivacySettings,
  searchUsers,
  getUserById,
  blockUser,
  unblockUser,
  getBlockedUsers,
  deleteAccount
} = require('../controllers/userController');

const { protect, authorize, ownerOrAdmin } = require('../middleware/auth');
const { checkAccountStatus, require2FA } = require('../middleware/security');
const {
  validateBody,
  validateParams,
  validateQuery,
  updateProfileValidation,
  privacySettingsValidation,
  objectIdValidation,
  paginationValidation
} = require('../validation/validators');

const router = express.Router();

// All routes require authentication
router.use(protect);
router.use(checkAccountStatus);

// User profile routes
router
  .route('/profile')
  .get(getProfile)
  .put(validateBody(updateProfileValidation), updateProfile)
  .delete(require2FA, deleteAccount);

// Privacy settings
router.put('/privacy-settings', validateBody(privacySettingsValidation), updatePrivacySettings);

// User blocking
router.post('/block/:userId', validateParams({ userId: objectIdValidation }), blockUser);

router.delete('/block/:userId', validateParams({ userId: objectIdValidation }), unblockUser);

router.get('/blocked', getBlockedUsers);

// Public user routes
router.get('/search', validateQuery(paginationValidation), searchUsers);

router.get('/:userId', validateParams({ userId: objectIdValidation }), getUserById);

// Admin only routes
// TODO: Create getAllUsers function in userController

module.exports = router;
