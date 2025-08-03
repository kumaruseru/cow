const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: false,
    trim: true,
    minlength: 1,
    maxlength: 50,
    default: ''
  },
  lastName: {
    type: String,
    required: false,
    trim: true,
    minlength: 1,
    maxlength: 50,
    default: ''
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  password: {
    type: String,
    minlength: 6
  },
  passwordHash: {
    type: String,
    minlength: 60 // bcrypt hash length
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user'
  },
  verified: {
    type: Boolean,
    default: false
  },
  birthDate: Date,
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    default: null
  },
  avatar: {
    type: String,
    default: ''
  },
  coverPhoto: {
    type: String,
    default: ''
  },
  profile: {
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    avatar: {
      type: String,
      default: function() {
        return `https://placehold.co/48x48/000000/FFFFFF?text=${this.firstName ? this.firstName[0].toUpperCase() : 'U'}`;
      }
    },
    coverPhoto: {
      type: String,
      default: ''
    },
    bio: { type: String, default: '' },
    location: { type: String, default: '' },
    website: { type: String, default: '' },
    phone: { type: String, default: '' }
  },
  preferences: {
    theme: { type: String, enum: ['light', 'dark'], default: 'light' },
    language: { type: String, default: 'vi' },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    },
    privacy: {
      profileVisibility: { type: String, enum: ['public', 'friends', 'private'], default: 'public' },
      showEmail: { type: Boolean, default: false },
      showPhone: { type: Boolean, default: false }
    }
  },
  activity: {
    lastLogin: Date,
    loginCount: { type: Number, default: 0 },
    lastActive: Date,
    loginAttempts: { type: Number, default: 0 },
    lockUntil: Date
  },
  twoFactorSecret: String,
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  // Password Reset
  passwordResetToken: String,
  passwordResetExpires: Date,
  refreshTokens: [{
    token: String,
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 604800 // 7 days
    }
  }]
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.passwordHash;
      delete ret.twoFactorSecret;
      delete ret.refreshTokens;
      return ret;
    }
  }
});

// Pre-save middleware to hash password
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.password, salt);
    this.password = undefined; // Remove the plain password
    next();
  } catch (error) {
    next(error);
  }
});

// Virtual for account lock status
UserSchema.virtual('isLocked').get(function() {
  return !!(this.activity.lockUntil && this.activity.lockUntil > Date.now());
});

// Methods
UserSchema.methods.comparePassword = async function(candidatePassword) {
  if (this.isLocked) {
    throw new Error('Account is locked');
  }
  
  const isMatch = await bcrypt.compare(candidatePassword, this.passwordHash);
  
  if (!isMatch) {
    this.activity.loginAttempts += 1;
    if (this.activity.loginAttempts >= 5) {
      this.activity.lockUntil = Date.now() + 30 * 60 * 1000; // Lock for 30 minutes
    }
    await this.save();
    return false;
  }
  
  // Reset login attempts on successful login
  if (this.activity.loginAttempts > 0) {
    this.activity.loginAttempts = 0;
    this.activity.lockUntil = undefined;
  }
  this.activity.lastLogin = new Date();
  await this.save();
  
  return true;
};

UserSchema.methods.addRefreshToken = function(token) {
  this.refreshTokens.push({ token });
  // Keep only last 5 refresh tokens
  if (this.refreshTokens.length > 5) {
    this.refreshTokens = this.refreshTokens.slice(-5);
  }
  return this.save();
};

UserSchema.methods.removeRefreshToken = function(token) {
  this.refreshTokens = this.refreshTokens.filter(rt => rt.token !== token);
  return this.save();
};

// Static methods
UserSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Indexes for performance
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', UserSchema);
