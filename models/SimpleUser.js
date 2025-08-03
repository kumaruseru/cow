const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  avatar: String,
  lastActivity: { type: Date, default: Date.now },
  isOnline: { type: Boolean, default: false },
  bio: String,
  location: String,
  website: String,
  joinDate: { type: Date, default: Date.now },
  verified: { type: Boolean, default: false },
  private: { type: Boolean, default: false },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date
});

// Virtual for account lock status
UserSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

module.exports = mongoose.model('User', UserSchema);
