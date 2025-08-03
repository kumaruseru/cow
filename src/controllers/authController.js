const crypto = require('crypto');
const User = require('../models/User');
const logger = require('../utils/logger');
const sendEmail = require('../utils/sendEmail');

// Helper function to send token response
const sendTokenResponse = (user, statusCode, res, message = 'Success') => {
  const token = user.getSignedJwtToken();

  const options = {
    expires: new Date(
      Date.now() + (parseInt(process.env.JWT_COOKIE_EXPIRE) || 7) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  };

  // Remove password from output
  user.password = undefined;

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      message,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePicture: user.profilePicture,
        isEmailVerified: user.isEmailVerified,
        role: user.role,
        createdAt: user.createdAt
      }
    });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { username, email, password, firstName, lastName, dateOfBirth, gender } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      const field = existingUser.email === email ? 'email' : 'username';
      return res.status(400).json({
        success: false,
        error: `User with this ${field} already exists`
      });
    }

    // Create user
    const user = await User.create({
      username,
      email,
      password,
      firstName,
      lastName,
      dateOfBirth,
      gender
    });

    // Generate email verification token
    const verificationToken = user.getEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    // Send verification email
    try {
      const verificationUrl = `${req.protocol}://${req.get(
        'host'
      )}/api/auth/verify-email/${verificationToken}`;

      const message = `
        Welcome to Cow Social Network!
        
        Please verify your email address by clicking the link below:
        ${verificationUrl}
        
        This link will expire in 24 hours.
        
        If you did not create this account, please ignore this email.
      `;

      await sendEmail({
        email: user.email,
        subject: 'Email Verification - Cow Social Network',
        message
      });

      logger.info(`Verification email sent to ${user.email}`);
    } catch (err) {
      logger.error('Email could not be sent:', err.message);
      user.emailVerificationToken = undefined;
      user.emailVerificationExpire = undefined;
      await user.save({ validateBeforeSave: false });
    }

    sendTokenResponse(
      user,
      201,
      res,
      'User registered successfully. Please check your email to verify your account.'
    );
  } catch (error) {
    logger.error('Registration error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Server error during registration'
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { login, password, rememberMe } = req.body;

    // Find user by email or username
    const user = await User.findOne({
      $or: [{ email: login.toLowerCase() }, { username: login.toLowerCase() }]
    }).select('+password +loginAttempts +lockUntil');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({
        success: false,
        error: 'Account temporarily locked due to too many failed login attempts'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account has been deactivated'
      });
    }

    // Check if account is banned
    if (user.isBanned) {
      return res.status(401).json({
        success: false,
        error: 'Account has been banned'
      });
    }

    // Check password
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      // Increment login attempts
      await user.incLoginAttempts();

      logger.warn(`Failed login attempt for user ${user.username} from IP ${req.ip}`);

      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Update last active and online status
    user.lastActive = new Date();
    user.isOnline = true;
    await user.save({ validateBeforeSave: false });

    logger.info(`User ${user.username} logged in from IP ${req.ip}`);

    sendTokenResponse(user, 200, res, 'Login successful');
  } catch (error) {
    logger.error('Login error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Server error during login'
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
  try {
    // Update user online status
    req.user.isOnline = false;
    await req.user.save({ validateBeforeSave: false });

    res.cookie('token', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    logger.info(`User ${req.user.username} logged out`);

    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    logger.error('Logout error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Server error during logout'
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('friends.user', 'username firstName lastName profilePicture')
      .select(
        '-password -passwordResetToken -passwordResetExpire -emailVerificationToken -emailVerificationExpire'
      );

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    logger.error('Get me error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Verify email
// @route   GET /api/auth/verify-email/:token
// @access  Public
exports.verifyEmail = async (req, res, next) => {
  try {
    // Get hashed token
    const emailVerificationToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      emailVerificationToken,
      emailVerificationExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification token'
      });
    }

    // Update user
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save({ validateBeforeSave: false });

    logger.info(`Email verified for user ${user.username}`);

    res.status(200).json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    logger.error('Email verification error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Server error during email verification'
    });
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If a user with that email exists, a password reset email has been sent'
      });
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    // Create reset URL
    const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;

    const message = `
      You are receiving this email because you (or someone else) has requested the reset of a password.
      
      Please go to the following link to reset your password:
      ${resetUrl}
      
      This link will expire in 10 minutes.
      
      If you did not request this, please ignore this email.
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Password Reset Request - Cow Social Network',
        message
      });

      logger.info(`Password reset email sent to ${user.email}`);

      res.status(200).json({
        success: true,
        message: 'If a user with that email exists, a password reset email has been sent'
      });
    } catch (err) {
      logger.error('Password reset email could not be sent:', err.message);

      user.passwordResetToken = undefined;
      user.passwordResetExpire = undefined;
      await user.save({ validateBeforeSave: false });

      res.status(500).json({
        success: false,
        error: 'Email could not be sent'
      });
    }
  } catch (error) {
    logger.error('Forgot password error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:token
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    // Get hashed token
    const passwordResetToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      passwordResetToken,
      passwordResetExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token'
      });
    }

    // Set new password
    user.password = req.body.password;
    user.passwordResetToken = undefined;
    user.passwordResetExpire = undefined;
    user.passwordChangedAt = Date.now();
    await user.save();

    logger.info(`Password reset for user ${user.username}`);

    sendTokenResponse(user, 200, res, 'Password reset successful');
  } catch (error) {
    logger.error('Reset password error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Server error during password reset'
    });
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isMatch = await user.matchPassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    user.passwordChangedAt = Date.now();
    await user.save();

    logger.info(`Password changed for user ${user.username}`);

    sendTokenResponse(user, 200, res, 'Password changed successfully');
  } catch (error) {
    logger.error('Change password error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Server error during password change'
    });
  }
};

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Private
exports.resendVerification = async (req, res, next) => {
  try {
    const user = req.user;

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        error: 'Email is already verified'
      });
    }

    // Generate new verification token
    const verificationToken = user.getEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    // Send verification email
    const verificationUrl = `${req.protocol}://${req.get(
      'host'
    )}/api/auth/verify-email/${verificationToken}`;

    const message = `
      Please verify your email address by clicking the link below:
      ${verificationUrl}
      
      This link will expire in 24 hours.
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Email Verification - Cow Social Network',
        message
      });

      logger.info(`Verification email resent to ${user.email}`);

      res.status(200).json({
        success: true,
        message: 'Verification email sent'
      });
    } catch (err) {
      logger.error('Verification email could not be sent:', err.message);

      user.emailVerificationToken = undefined;
      user.emailVerificationExpire = undefined;
      await user.save({ validateBeforeSave: false });

      res.status(500).json({
        success: false,
        error: 'Email could not be sent'
      });
    }
  } catch (error) {
    logger.error('Resend verification error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};
