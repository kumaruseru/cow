const mongoose = require('mongoose');

const friendSchema = new mongoose.Schema({
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SimpleUser',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SimpleUser',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'blocked'],
    default: 'pending'
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  acceptedAt: {
    type: Date
  },
  blockedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate friend requests
friendSchema.index({ requester: 1, recipient: 1 }, { unique: true });

// Instance methods
friendSchema.methods.accept = function() {
  this.status = 'accepted';
  this.acceptedAt = new Date();
  return this.save();
};

friendSchema.methods.block = function() {
  this.status = 'blocked';
  this.blockedAt = new Date();
  return this.save();
};

// Static methods
friendSchema.statics.getFriends = async function(userId) {
  return this.find({
    $or: [
      { requester: userId, status: 'accepted' },
      { recipient: userId, status: 'accepted' }
    ]
  })
  .populate('requester', 'firstName lastName email avatar')
  .populate('recipient', 'firstName lastName email avatar');
};

friendSchema.statics.getPendingRequests = async function(userId) {
  return this.find({
    recipient: userId,
    status: 'pending'
  })
  .populate('requester', 'firstName lastName email avatar');
};

friendSchema.statics.getSentRequests = async function(userId) {
  return this.find({
    requester: userId,
    status: 'pending'
  })
  .populate('recipient', 'firstName lastName email avatar');
};

friendSchema.statics.getFriendshipStatus = async function(userId1, userId2) {
  return this.findOne({
    $or: [
      { requester: userId1, recipient: userId2 },
      { requester: userId2, recipient: userId1 }
    ]
  });
};

module.exports = mongoose.model('Friend', friendSchema);
