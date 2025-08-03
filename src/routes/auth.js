const express = require('express');
const {
  register,
  login,
  logout,
  getMe,
  verifyEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  resendVerification
} = require('../controllers/authController');

const { protect, authRateLimit } = require('../middleware/auth');
const {
  auditFailedLogin,
  auditSuccessfulLogin,
  auditLogout,
  auditPasswordChange
} = require('../middleware/securityAudit');
const {
  bruteForceProtection,
  validateOrigin,
  checkAccountStatus,
  require2FA
} = require('../middleware/security');
const {
  validateBody,
  validateParams,
  registerValidation,
  loginValidation,
  changePasswordValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  objectIdValidation
} = require('../validation/validators');

const router = express.Router();

// Public routes
router.post('/register', authRateLimit, validateBody(registerValidation), register);

router.post(
  '/login',
  authRateLimit,
  bruteForceProtection(5, 15 * 60 * 1000),
  validateOrigin,
  validateBody(loginValidation),
  auditSuccessfulLogin,
  login
);

router.get('/verify-email/:token', verifyEmail);

router.post(
  '/forgot-password',
  authRateLimit,
  validateBody(forgotPasswordValidation),
  forgotPassword
);

router.put(
  '/reset-password/:token',
  authRateLimit,
  validateBody(resetPasswordValidation),
  resetPassword
);

// Protected routes
router.use(protect); // All routes after this middleware are protected
router.use(checkAccountStatus); // Check account status for all protected routes

router.get('/me', getMe);

router.post('/logout', auditLogout, logout);

router.put(
  '/change-password',
  require2FA,
  validateBody(changePasswordValidation),
  auditPasswordChange,
  changePassword
);

router.post('/resend-verification', resendVerification);

module.exports = router;
