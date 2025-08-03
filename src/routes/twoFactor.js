const express = require('express');
const { protect } = require('../middleware/auth');
const { validateBody, validateParams, objectIdValidation } = require('../validation/validators');
const TwoFactorAuthService = require('../services/twoFactorService');
const User = require('../models/User');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(protect);

// @desc    Setup 2FA - Generate secret and QR code
// @route   POST /api/2fa/setup
// @access  Private
router.post('/setup', async (req, res) => {
  try {
    const user = req.user;

    if (user.twoFactorAuth.enabled) {
      return res.status(400).json({
        success: false,
        error: 'Two-factor authentication is already enabled'
      });
    }

    // Generate secret
    const secretData = TwoFactorAuthService.generateSecret(user.email, 'Cow Social Network');

    // Generate QR code
    const qrCodeDataURL = await TwoFactorAuthService.generateQRCode(secretData.otpauth_url);

    // Temporarily store secret (not yet enabled)
    user.twoFactorAuth.secret = secretData.secret;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      data: {
        secret: secretData.secret,
        qrCode: qrCodeDataURL,
        manualEntryKey: secretData.manual_entry_key,
        instructions:
          'Scan the QR code with your authenticator app and enter the verification code to complete setup'
      }
    });
  } catch (error) {
    logger.error('2FA setup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to setup two-factor authentication'
    });
  }
});

// @desc    Verify and enable 2FA
// @route   POST /api/2fa/verify
// @access  Private
router.post(
  '/verify',
  validateBody({
    token: {
      type: 'string',
      required: true,
      pattern: /^\d{6}$/,
      messages: {
        'string.pattern.base': 'Token must be a 6-digit number'
      }
    }
  }),
  async (req, res) => {
    try {
      const { token } = req.body;
      const user = req.user;

      if (user.twoFactorAuth.enabled) {
        return res.status(400).json({
          success: false,
          error: 'Two-factor authentication is already enabled'
        });
      }

      if (!user.twoFactorAuth.secret) {
        return res.status(400).json({
          success: false,
          error: 'Please setup 2FA first'
        });
      }

      // Validate the setup
      const validation = await TwoFactorAuthService.validateSetup(user.twoFactorAuth.secret, token);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: validation.error
        });
      }

      // Enable 2FA
      await user.enableTwoFactor(user.twoFactorAuth.secret, validation.backupCodes);

      logger.info(`2FA enabled for user ${user.username}`);

      res.status(200).json({
        success: true,
        message: 'Two-factor authentication enabled successfully',
        backupCodes: validation.backupCodes
      });
    } catch (error) {
      logger.error('2FA verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify two-factor authentication'
      });
    }
  }
);

// @desc    Disable 2FA
// @route   POST /api/2fa/disable
// @access  Private
router.post(
  '/disable',
  validateBody({
    password: {
      type: 'string',
      required: true
    },
    token: {
      type: 'string',
      required: true
    }
  }),
  async (req, res) => {
    try {
      const { password, token } = req.body;
      const user = await User.findById(req.user.id).select('+password');

      if (!user.twoFactorAuth.enabled) {
        return res.status(400).json({
          success: false,
          error: 'Two-factor authentication is not enabled'
        });
      }

      // Verify password
      const isPasswordValid = await user.matchPassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid password'
        });
      }

      // Verify 2FA token or backup code
      let isTokenValid = false;

      if (token.length === 6 && /^\d+$/.test(token)) {
        // Regular TOTP token
        isTokenValid = TwoFactorAuthService.verifyToken(user.twoFactorAuth.secret, token);
      } else if (token.length === 8) {
        // Backup code
        isTokenValid = user.useBackupCode(token);
      }

      if (!isTokenValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid verification code'
        });
      }

      // Disable 2FA
      await user.disableTwoFactor();

      logger.info(`2FA disabled for user ${user.username}`);

      res.status(200).json({
        success: true,
        message: 'Two-factor authentication disabled successfully'
      });
    } catch (error) {
      logger.error('2FA disable error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to disable two-factor authentication'
      });
    }
  }
);

// @desc    Generate new backup codes
// @route   POST /api/2fa/backup-codes
// @access  Private
router.post(
  '/backup-codes',
  validateBody({
    password: {
      type: 'string',
      required: true
    }
  }),
  async (req, res) => {
    try {
      const { password } = req.body;
      const user = await User.findById(req.user.id).select('+password');

      if (!user.twoFactorAuth.enabled) {
        return res.status(400).json({
          success: false,
          error: 'Two-factor authentication is not enabled'
        });
      }

      // Verify password
      const isPasswordValid = await user.matchPassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid password'
        });
      }

      // Generate new backup codes
      const newBackupCodes = TwoFactorAuthService.generateBackupCodes();
      user.twoFactorAuth.backupCodes = newBackupCodes;
      await user.save({ validateBeforeSave: false });

      logger.info(`New backup codes generated for user ${user.username}`);

      res.status(200).json({
        success: true,
        message: 'New backup codes generated successfully',
        backupCodes: newBackupCodes
      });
    } catch (error) {
      logger.error('Backup codes generation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate backup codes'
      });
    }
  }
);

// @desc    Verify 2FA token (for sensitive operations)
// @route   POST /api/2fa/verify-token
// @access  Private
router.post(
  '/verify-token',
  validateBody({
    token: {
      type: 'string',
      required: true
    }
  }),
  async (req, res) => {
    try {
      const { token } = req.body;
      const user = req.user;

      if (!user.twoFactorAuth.enabled) {
        return res.status(400).json({
          success: false,
          error: 'Two-factor authentication is not enabled'
        });
      }

      let isValid = false;

      if (token.length === 6 && /^\d+$/.test(token)) {
        // TOTP token
        isValid = TwoFactorAuthService.verifyToken(user.twoFactorAuth.secret, token);
      } else if (token.length === 8) {
        // Backup code
        isValid = user.useBackupCode(token);
        if (isValid) {
          await user.save({ validateBeforeSave: false });
        }
      }

      if (!isValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid verification code'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Token verified successfully'
      });
    } catch (error) {
      logger.error('Token verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify token'
      });
    }
  }
);

// @desc    Get 2FA status
// @route   GET /api/2fa/status
// @access  Private
router.get('/status', (req, res) => {
  try {
    const user = req.user;

    res.status(200).json({
      success: true,
      data: {
        enabled: user.twoFactorAuth.enabled,
        backupCodesCount: user.twoFactorAuth.backupCodes
          ? user.twoFactorAuth.backupCodes.length
          : 0,
        setupCompletedAt: user.twoFactorAuth.setupCompletedAt,
        lastUsedBackupCode: user.twoFactorAuth.lastUsedBackupCode ? '****' : null
      }
    });
  } catch (error) {
    logger.error('2FA status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get 2FA status'
    });
  }
});

module.exports = router;
