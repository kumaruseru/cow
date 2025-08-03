const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema(
  {
    // Basic Information
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false // Don't include password in queries by default
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters']
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters']
    },

    // Profile Information
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required'],
      validate: {
        validator: function (value) {
          return value < new Date();
        },
        message: 'Date of birth must be in the past'
      }
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say'],
      default: 'prefer_not_to_say'
    },
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
      trim: true
    },
    location: {
      city: String,
      country: String
    },
    website: {
      type: String,
      validate: {
        validator: function (v) {
          return !v || /^https?:\/\/.+/.test(v);
        },
        message: 'Website must be a valid URL'
      }
    },

    // Profile Images
    profilePicture: {
      url: String,
      publicId: String // For Cloudinary
    },
    coverPhoto: {
      url: String,
      publicId: String
    },

    // Account Status
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isBanned: {
      type: Boolean,
      default: false
    },
    isPrivate: {
      type: Boolean,
      default: false
    },

    // Security
    twoFactorAuth: {
      enabled: {
        type: Boolean,
        default: false
      },
      secret: String,
      backupCodes: [String],
      recoveryCode: String,
      lastUsedBackupCode: String,
      setupCompletedAt: Date
    },

    // Device security
    trustedDevices: [
      {
        deviceId: String,
        deviceName: String,
        deviceType: String, // 'mobile', 'desktop', 'tablet'
        userAgent: String,
        ipAddress: String,
        location: {
          country: String,
          city: String,
          coordinates: [Number] // [longitude, latitude]
        },
        trustToken: String,
        addedAt: {
          type: Date,
          default: Date.now
        },
        lastUsedAt: Date,
        isActive: {
          type: Boolean,
          default: true
        }
      }
    ],

    // Login security
    loginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: Date,

    // Session management
    activeSessions: [
      {
        sessionId: String,
        deviceInfo: {
          deviceId: String,
          userAgent: String,
          ipAddress: String,
          location: String
        },
        createdAt: {
          type: Date,
          default: Date.now
        },
        lastActivity: {
          type: Date,
          default: Date.now
        },
        expiresAt: Date
      }
    ],

    // Encryption keys for E2E messaging
    encryptionKeys: {
      publicKey: String,
      privateKeyHash: String, // Hashed private key (never store raw private key)
      keyVersion: {
        type: Number,
        default: 1
      },
      keyType: {
        type: String,
        enum: ['rsa', 'x25519'],
        default: 'x25519'
      },
      createdAt: {
        type: Date,
        default: Date.now
      },
      rotationSchedule: Date // When to rotate keys
    },

    // Security settings
    securitySettings: {
      requireTwoFactorForSensitiveActions: {
        type: Boolean,
        default: false
      },
      loginNotifications: {
        type: Boolean,
        default: true
      },
      sessionTimeout: {
        type: Number,
        default: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
      },
      allowMultipleSessions: {
        type: Boolean,
        default: true
      },
      requireDeviceVerification: {
        type: Boolean,
        default: false
      },
      endToEndEncryption: {
        type: Boolean,
        default: true
      }
    },

    // Security audit trail
    securityEvents: [
      {
        eventType: {
          type: String,
          enum: [
            'login_success',
            'login_failed',
            'password_changed',
            'two_factor_enabled',
            'two_factor_disabled',
            'device_added',
            'device_removed',
            'suspicious_activity',
            'account_locked',
            'account_unlocked',
            'key_rotation',
            'security_settings_changed'
          ]
        },
        description: String,
        ipAddress: String,
        userAgent: String,
        location: String,
        deviceId: String,
        timestamp: {
          type: Date,
          default: Date.now
        },
        severity: {
          type: String,
          enum: ['low', 'medium', 'high', 'critical'],
          default: 'low'
        }
      }
    ],

    passwordChangedAt: Date,
    emailVerificationToken: String,
    emailVerificationExpire: Date,
    passwordResetToken: String,
    passwordResetExpire: Date,

    // Social Features
    friends: [
      {
        user: {
          type: mongoose.Schema.ObjectId,
          ref: 'User'
        },
        status: {
          type: String,
          enum: ['pending', 'accepted', 'blocked'],
          default: 'pending'
        },
        addedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    friendRequests: [
      {
        from: {
          type: mongoose.Schema.ObjectId,
          ref: 'User'
        },
        sentAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    blockedUsers: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      }
    ],

    // Privacy Settings
    privacySettings: {
      profileVisibility: {
        type: String,
        enum: ['public', 'friends', 'private'],
        default: 'friends'
      },
      postVisibility: {
        type: String,
        enum: ['public', 'friends', 'private'],
        default: 'friends'
      },
      allowFriendRequests: {
        type: Boolean,
        default: true
      },
      showOnlineStatus: {
        type: Boolean,
        default: true
      },
      allowMessageFromStrangers: {
        type: Boolean,
        default: false
      }
    },

    // Notification Settings
    notificationSettings: {
      email: {
        newMessage: { type: Boolean, default: true },
        friendRequest: { type: Boolean, default: true },
        postLike: { type: Boolean, default: true },
        postComment: { type: Boolean, default: true },
        weeklyDigest: { type: Boolean, default: true }
      },
      push: {
        newMessage: { type: Boolean, default: true },
        friendRequest: { type: Boolean, default: true },
        postLike: { type: Boolean, default: false },
        postComment: { type: Boolean, default: true }
      }
    },

    // Statistics
    stats: {
      postsCount: { type: Number, default: 0 },
      friendsCount: { type: Number, default: 0 },
      followersCount: { type: Number, default: 0 },
      followingCount: { type: Number, default: 0 }
    },

    // Activity
    lastActive: {
      type: Date,
      default: Date.now
    },
    isOnline: {
      type: Boolean,
      default: false
    },

    // Role and Permissions
    role: {
      type: String,
      enum: ['user', 'moderator', 'admin'],
      default: 'user'
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for user's age
UserSchema.virtual('age').get(function () {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birth = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
});

// Virtual for full name
UserSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for account lock status
UserSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Indexes for better performance (username and email already have unique: true)
UserSchema.index({ 'friends.user': 1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ lastActive: -1 });

// Encrypt password using bcrypt
UserSchema.pre('save', async function (next) {
  // Only run this function if password was actually modified
  if (!this.isModified('password')) return next();

  // Hash the password with cost of 12
  const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
  this.password = await bcrypt.hash(this.password, salt);

  // Set password changed timestamp
  this.passwordChangedAt = Date.now() - 1000; // Subtract 1 second to ensure JWT is created after password change

  next();
});

// Sign JWT and return
UserSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Check if password was changed after JWT was issued
UserSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Handle login attempts and account locking
UserSchema.methods.incLoginAttempts = function () {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  // Lock account after max attempts
  const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
  const lockTime = parseInt(process.env.LOCKOUT_TIME) || 3600000; // 1 hour

  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }

  return this.updateOne(updates);
};

// Reset login attempts
UserSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Generate and hash password token
UserSchema.methods.getResetPasswordToken = function () {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to resetPasswordToken field
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  // Set expire
  this.passwordResetExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

// Generate email verification token
UserSchema.methods.getEmailVerificationToken = function () {
  // Generate token
  const verificationToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to emailVerificationToken field
  this.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

  // Set expire
  this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  return verificationToken;
};

// Update last active timestamp
UserSchema.methods.updateLastActive = function () {
  this.lastActive = new Date();
  return this.save({ validateBeforeSave: false });
};

// Add friend
UserSchema.methods.addFriend = function (friendId) {
  if (!this.friends.some(friend => friend.user.toString() === friendId.toString())) {
    this.friends.push({ user: friendId, status: 'accepted' });
    this.stats.friendsCount += 1;
  }
  return this.save({ validateBeforeSave: false });
};

// Remove friend
UserSchema.methods.removeFriend = function (friendId) {
  this.friends = this.friends.filter(friend => friend.user.toString() !== friendId.toString());
  this.stats.friendsCount = Math.max(0, this.stats.friendsCount - 1);
  return this.save({ validateBeforeSave: false });
};

// Block user
UserSchema.methods.blockUser = function (userId) {
  if (!this.blockedUsers.includes(userId)) {
    this.blockedUsers.push(userId);
    // Remove from friends if exists
    this.removeFriend(userId);
  }
  return this.save({ validateBeforeSave: false });
};

// Unblock user
UserSchema.methods.unblockUser = function (userId) {
  this.blockedUsers = this.blockedUsers.filter(id => id.toString() !== userId.toString());
  return this.save({ validateBeforeSave: false });
};

// Add trusted device
UserSchema.methods.addTrustedDevice = function (deviceInfo) {
  const deviceId = crypto.randomBytes(16).toString('hex');
  const trustToken = crypto.randomBytes(32).toString('hex');

  this.trustedDevices.push({
    deviceId,
    deviceName: deviceInfo.deviceName,
    deviceType: deviceInfo.deviceType,
    userAgent: deviceInfo.userAgent,
    ipAddress: deviceInfo.ipAddress,
    location: deviceInfo.location,
    trustToken,
    addedAt: new Date(),
    lastUsedAt: new Date(),
    isActive: true
  });

  // Log security event
  this.addSecurityEvent('device_added', `New device added: ${deviceInfo.deviceName}`, deviceInfo);

  return this.save({ validateBeforeSave: false });
};

// Remove trusted device
UserSchema.methods.removeTrustedDevice = function (deviceId) {
  const device = this.trustedDevices.find(d => d.deviceId === deviceId);
  if (device) {
    this.trustedDevices = this.trustedDevices.filter(d => d.deviceId !== deviceId);
    this.addSecurityEvent('device_removed', `Device removed: ${device.deviceName}`);
    return this.save({ validateBeforeSave: false });
  }
  return Promise.resolve(this);
};

// Check if device is trusted
UserSchema.methods.isDeviceTrusted = function (deviceId, trustToken) {
  const device = this.trustedDevices.find(d => d.deviceId === deviceId && d.isActive);
  if (device && device.trustToken === trustToken) {
    // Update last used time
    device.lastUsedAt = new Date();
    this.save({ validateBeforeSave: false });
    return true;
  }
  return false;
};

// Add security event
UserSchema.methods.addSecurityEvent = function (eventType, description, metadata = {}) {
  this.securityEvents.push({
    eventType,
    description,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
    location: metadata.location,
    deviceId: metadata.deviceId,
    timestamp: new Date(),
    severity: this.getEventSeverity(eventType)
  });

  // Keep only last 100 events
  if (this.securityEvents.length > 100) {
    this.securityEvents = this.securityEvents.slice(-100);
  }

  return this.save({ validateBeforeSave: false });
};

// Get event severity
UserSchema.methods.getEventSeverity = function (eventType) {
  const severityMap = {
    login_success: 'low',
    login_failed: 'medium',
    password_changed: 'high',
    two_factor_enabled: 'medium',
    two_factor_disabled: 'high',
    device_added: 'medium',
    device_removed: 'medium',
    suspicious_activity: 'high',
    account_locked: 'critical',
    account_unlocked: 'high',
    key_rotation: 'medium',
    security_settings_changed: 'medium'
  };
  return severityMap[eventType] || 'low';
};

// Create new session
UserSchema.methods.createSession = function (deviceInfo) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + this.securitySettings.sessionTimeout);

  this.activeSessions.push({
    sessionId,
    deviceInfo,
    createdAt: new Date(),
    lastActivity: new Date(),
    expiresAt
  });

  // Remove expired sessions
  this.cleanupExpiredSessions();

  return this.save({ validateBeforeSave: false }).then(() => sessionId);
};

// Update session activity
UserSchema.methods.updateSessionActivity = function (sessionId) {
  const session = this.activeSessions.find(s => s.sessionId === sessionId);
  if (session) {
    session.lastActivity = new Date();
    return this.save({ validateBeforeSave: false });
  }
  return Promise.resolve(this);
};

// Remove session
UserSchema.methods.removeSession = function (sessionId) {
  this.activeSessions = this.activeSessions.filter(s => s.sessionId !== sessionId);
  return this.save({ validateBeforeSave: false });
};

// Cleanup expired sessions
UserSchema.methods.cleanupExpiredSessions = function () {
  const now = new Date();
  this.activeSessions = this.activeSessions.filter(s => s.expiresAt > now);
};

// Check if session is valid
UserSchema.methods.isSessionValid = function (sessionId) {
  this.cleanupExpiredSessions();
  const session = this.activeSessions.find(s => s.sessionId === sessionId);
  return session && session.expiresAt > new Date();
};

// Generate encryption key pair
UserSchema.methods.generateEncryptionKeys = async function () {
  try {
    const encryptionService = require('../services/encryptionService');
    const keyPair = await encryptionService.generateX25519KeyPair();

    // Store public key and hash of private key
    this.encryptionKeys = {
      publicKey: keyPair.publicKey,
      privateKeyHash: crypto.createHash('sha256').update(keyPair.privateKey).digest('hex'),
      keyVersion: (this.encryptionKeys?.keyVersion || 0) + 1,
      keyType: 'x25519',
      createdAt: new Date(),
      rotationSchedule: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
    };

    this.addSecurityEvent('key_rotation', 'Encryption keys generated/rotated');

    await this.save({ validateBeforeSave: false });

    // Return private key only once (client must store it securely)
    return {
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey, // Only returned once!
      keyVersion: this.encryptionKeys.keyVersion
    };
  } catch (error) {
    throw new Error('Failed to generate encryption keys');
  }
};

// Check if keys need rotation
UserSchema.methods.needsKeyRotation = function () {
  if (!this.encryptionKeys || !this.encryptionKeys.rotationSchedule) {
    return true;
  }
  return new Date() > this.encryptionKeys.rotationSchedule;
};

// Enable two-factor authentication
UserSchema.methods.enableTwoFactor = function (secret, backupCodes) {
  this.twoFactorAuth = {
    enabled: true,
    secret: secret,
    backupCodes: backupCodes,
    setupCompletedAt: new Date()
  };

  this.addSecurityEvent('two_factor_enabled', 'Two-factor authentication enabled');
  return this.save({ validateBeforeSave: false });
};

// Disable two-factor authentication
UserSchema.methods.disableTwoFactor = function () {
  this.twoFactorAuth = {
    enabled: false,
    secret: undefined,
    backupCodes: [],
    setupCompletedAt: undefined
  };

  this.addSecurityEvent('two_factor_disabled', 'Two-factor authentication disabled');
  return this.save({ validateBeforeSave: false });
};

// Use backup code
UserSchema.methods.useBackupCode = function (code) {
  const index = this.twoFactorAuth.backupCodes.indexOf(code.toUpperCase());
  if (index !== -1) {
    this.twoFactorAuth.backupCodes.splice(index, 1);
    this.twoFactorAuth.lastUsedBackupCode = code.toUpperCase();
    this.save({ validateBeforeSave: false });
    return true;
  }
  return false;
};

// Check for suspicious activity
UserSchema.methods.checkSuspiciousActivity = function (loginInfo) {
  const recentEvents = this.securityEvents.filter(
    event => event.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
  );

  const failedLogins = recentEvents.filter(event => event.eventType === 'login_failed').length;
  const differentIPs = new Set(recentEvents.map(event => event.ipAddress)).size;
  const differentLocations = new Set(recentEvents.map(event => event.location)).size;

  // Suspicious if:
  // - More than 3 failed logins in 24 hours
  // - Login from more than 3 different IPs
  // - Login from more than 2 different countries
  const isSuspicious = failedLogins > 3 || differentIPs > 3 || differentLocations > 2;

  if (isSuspicious) {
    this.addSecurityEvent('suspicious_activity', 'Suspicious login activity detected', loginInfo);
  }

  return isSuspicious;
};

// Update security settings
UserSchema.methods.updateSecuritySettings = function (newSettings) {
  Object.assign(this.securitySettings, newSettings);
  this.addSecurityEvent('security_settings_changed', 'Security settings updated');
  return this.save({ validateBeforeSave: false });
};

module.exports = mongoose.model('User', UserSchema);
