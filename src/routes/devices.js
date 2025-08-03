const express = require('express');
const { protect } = require('../middleware/auth');
const { validateBody } = require('../validation/validators');
const User = require('../models/User');
const crypto = require('crypto');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(protect);

// @desc    Get user's trusted devices
// @route   GET /api/devices
// @access  Private
router.get('/', async (req, res) => {
  try {
    const user = req.user;

    const devices = user.trustedDevices.map(device => ({
      id: device.id,
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      deviceType: device.deviceType,
      browser: device.browser,
      os: device.os,
      location: device.location,
      ipAddress: device.ipAddress,
      isCurrent: device.deviceId === req.headers['x-device-id'],
      lastSeen: device.lastSeen,
      addedAt: device.addedAt
    }));

    res.status(200).json({
      success: true,
      data: devices
    });
  } catch (error) {
    logger.error('Get devices error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get devices'
    });
  }
});

// @desc    Add new trusted device
// @route   POST /api/devices/trust
// @access  Private
router.post(
  '/trust',
  validateBody({
    deviceName: {
      type: 'string',
      required: true,
      min: 1,
      max: 100
    },
    deviceType: {
      type: 'string',
      required: true,
      valid: ['desktop', 'mobile', 'tablet']
    },
    browser: {
      type: 'string',
      required: false,
      max: 50
    },
    os: {
      type: 'string',
      required: false,
      max: 50
    },
    twoFactorToken: {
      type: 'string',
      required: true
    }
  }),
  async (req, res) => {
    try {
      const { deviceName, deviceType, browser, os, twoFactorToken } = req.body;
      const user = req.user;

      // Verify 2FA token
      const isValidToken = await user.verifyTwoFactorToken(twoFactorToken);
      if (!isValidToken) {
        return res.status(401).json({
          success: false,
          error: 'Invalid two-factor authentication token'
        });
      }

      // Generate device ID
      const deviceId = crypto.randomBytes(16).toString('hex');

      // Get location and IP from request
      const ipAddress = req.ip || req.connection.remoteAddress;
      const location = req.headers['x-location'] || 'Unknown';

      // Add device
      const device = await user.addTrustedDevice({
        deviceId,
        deviceName,
        deviceType,
        browser,
        os,
        location,
        ipAddress
      });

      logger.info(`New trusted device added for user ${user.username}: ${deviceName}`);

      res.status(200).json({
        success: true,
        message: 'Device added to trusted devices successfully',
        data: {
          deviceId: device.deviceId,
          deviceName: device.deviceName,
          addedAt: device.addedAt
        }
      });
    } catch (error) {
      logger.error('Add trusted device error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add trusted device'
      });
    }
  }
);

// @desc    Remove trusted device
// @route   DELETE /api/devices/:deviceId
// @access  Private
router.delete(
  '/:deviceId',
  validateBody({
    password: {
      type: 'string',
      required: true
    },
    twoFactorToken: {
      type: 'string',
      required: true
    }
  }),
  async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { password, twoFactorToken } = req.body;
      const user = await User.findById(req.user.id).select('+password');

      // Verify password
      const isPasswordValid = await user.matchPassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid password'
        });
      }

      // Verify 2FA token
      const isValidToken = await user.verifyTwoFactorToken(twoFactorToken);
      if (!isValidToken) {
        return res.status(401).json({
          success: false,
          error: 'Invalid two-factor authentication token'
        });
      }

      // Remove device
      const removed = await user.removeTrustedDevice(deviceId);
      if (!removed) {
        return res.status(404).json({
          success: false,
          error: 'Device not found'
        });
      }

      logger.info(`Trusted device removed for user ${user.username}: ${deviceId}`);

      res.status(200).json({
        success: true,
        message: 'Device removed from trusted devices successfully'
      });
    } catch (error) {
      logger.error('Remove trusted device error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove trusted device'
      });
    }
  }
);

// @desc    Update device information
// @route   PUT /api/devices/:deviceId
// @access  Private
router.put(
  '/:deviceId',
  validateBody({
    deviceName: {
      type: 'string',
      required: false,
      min: 1,
      max: 100
    },
    deviceType: {
      type: 'string',
      required: false,
      valid: ['desktop', 'mobile', 'tablet']
    }
  }),
  async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { deviceName, deviceType } = req.body;
      const user = req.user;

      const device = user.trustedDevices.find(d => d.deviceId === deviceId);
      if (!device) {
        return res.status(404).json({
          success: false,
          error: 'Device not found'
        });
      }

      // Update device info
      if (deviceName) device.deviceName = deviceName;
      if (deviceType) device.deviceType = deviceType;
      device.lastSeen = new Date();

      await user.save({ validateBeforeSave: false });

      res.status(200).json({
        success: true,
        message: 'Device updated successfully',
        data: {
          deviceId: device.deviceId,
          deviceName: device.deviceName,
          deviceType: device.deviceType,
          lastSeen: device.lastSeen
        }
      });
    } catch (error) {
      logger.error('Update device error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update device'
      });
    }
  }
);

// @desc    Update device last seen
// @route   POST /api/devices/:deviceId/ping
// @access  Private
router.post('/:deviceId/ping', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const user = req.user;

    const device = user.trustedDevices.find(d => d.deviceId === deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    // Update last seen
    device.lastSeen = new Date();
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Device activity updated'
    });
  } catch (error) {
    logger.error('Device ping error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update device activity'
    });
  }
});

// @desc    Remove all trusted devices except current
// @route   POST /api/devices/remove-all
// @access  Private
router.post(
  '/remove-all',
  validateBody({
    password: {
      type: 'string',
      required: true
    },
    twoFactorToken: {
      type: 'string',
      required: true
    }
  }),
  async (req, res) => {
    try {
      const { password, twoFactorToken } = req.body;
      const user = await User.findById(req.user.id).select('+password');
      const currentDeviceId = req.headers['x-device-id'];

      // Verify password
      const isPasswordValid = await user.matchPassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid password'
        });
      }

      // Verify 2FA token
      const isValidToken = await user.verifyTwoFactorToken(twoFactorToken);
      if (!isValidToken) {
        return res.status(401).json({
          success: false,
          error: 'Invalid two-factor authentication token'
        });
      }

      // Keep only current device
      if (currentDeviceId) {
        user.trustedDevices = user.trustedDevices.filter(
          device => device.deviceId === currentDeviceId
        );
      } else {
        user.trustedDevices = [];
      }

      await user.save({ validateBeforeSave: false });

      logger.info(`All trusted devices removed for user ${user.username}`);

      res.status(200).json({
        success: true,
        message: 'All trusted devices removed successfully'
      });
    } catch (error) {
      logger.error('Remove all devices error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove all devices'
      });
    }
  }
);

module.exports = router;
