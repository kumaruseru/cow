const mongoose = require('mongoose');
const encryptionService = require('../services/encryptionService');

const MessageSchema = new mongoose.Schema(
  {
    // Basic message info
    conversationId: {
      type: String,
      required: true,
      index: true
    },

    sender: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true
    },

    recipient: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true
    },

    // Encrypted content
    encryptedContent: {
      encrypted: String,
      nonce: String,
      algorithm: String
    },

    // Message metadata
    messageType: {
      type: String,
      enum: ['text', 'image', 'video', 'audio', 'file', 'location', 'call', 'system'],
      default: 'text'
    },

    // Media attachments (encrypted)
    media: {
      encryptedUrl: String,
      encryptedMetadata: {
        encrypted: String,
        nonce: String,
        algorithm: String
      },
      thumbnailUrl: String,
      fileSize: Number,
      mimeType: String,
      duration: Number // for audio/video
    },

    // Enhanced Message Status
    status: {
      type: String,
      enum: ['sending', 'sent', 'delivered', 'read', 'failed'],
      default: 'sending'
    },

    // Detailed status timestamps
    sentAt: {
      type: Date,
      default: Date.now
    },
    deliveredAt: Date,
    readAt: Date,

    // Read receipts with enhanced info
    readReceipts: [
      {
        user: {
          type: mongoose.Schema.ObjectId,
          ref: 'User'
        },
        readAt: {
          type: Date,
          default: Date.now
        },
        deviceInfo: {
          type: String,
          default: 'unknown'
        }
      }
    ],

    // Delivery tracking
    deliveryAttempts: {
      type: Number,
      default: 0
    },
    lastDeliveryAttempt: Date,
    failureReason: String,

    // Status metadata
    statusHistory: [
      {
        status: {
          type: String,
          enum: ['sending', 'sent', 'delivered', 'read', 'failed']
        },
        timestamp: {
          type: Date,
          default: Date.now
        },
        metadata: {
          type: mongoose.Schema.Types.Mixed,
          default: {}
        }
      }
    ],

    // Message reactions
    reactions: [
      {
        user: {
          type: mongoose.Schema.ObjectId,
          ref: 'User'
        },
        emoji: String,
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ],

    // Reply/Thread info
    replyTo: {
      type: mongoose.Schema.ObjectId,
      ref: 'Message'
    },

    // Forward info
    forwardedFrom: {
      originalSender: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      originalMessageId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Message'
      }
    },

    // Edit history
    isEdited: {
      type: Boolean,
      default: false
    },

    editHistory: [
      {
        encryptedContent: {
          encrypted: String,
          nonce: String,
          algorithm: String
        },
        editedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],

    // Security features
    isEncrypted: {
      type: Boolean,
      default: true
    },

    encryptionKeyVersion: {
      type: Number,
      default: 1
    },

    // Self-destruct message
    expiresAt: Date,
    isExpired: {
      type: Boolean,
      default: false
    },

    // Message priority
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal'
    },

    // Location data (encrypted)
    location: {
      encryptedCoordinates: {
        encrypted: String,
        nonce: String,
        algorithm: String
      },
      placeName: String
    },

    // Call related data
    callData: {
      callId: String,
      callType: {
        type: String,
        enum: ['voice', 'video']
      },
      duration: Number,
      callStatus: {
        type: String,
        enum: ['missed', 'answered', 'declined', 'failed']
      }
    },

    // System message data
    systemData: {
      action: String, // 'user_joined', 'user_left', 'group_created', etc.
      affectedUsers: [
        {
          type: mongoose.Schema.ObjectId,
          ref: 'User'
        }
      ]
    },

    // Message visibility
    visibility: {
      type: String,
      enum: ['visible', 'deleted_for_sender', 'deleted_for_recipient', 'deleted_for_everyone'],
      default: 'visible'
    },

    deletedAt: Date,
    deletedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better performance
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ sender: 1, createdAt: -1 });
MessageSchema.index({ recipient: 1, createdAt: -1 });
MessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
MessageSchema.index({ status: 1 });

// Virtual for decrypted content (used in application layer)
MessageSchema.virtual('content').get(function () {
  return this._decryptedContent;
});

MessageSchema.virtual('content').set(function (value) {
  this._decryptedContent = value;
});

// Pre-save middleware to encrypt content
MessageSchema.pre('save', async function (next) {
  try {
    if (this.isModified('_decryptedContent') && this._decryptedContent) {
      // Get conversation encryption keys
      const senderKeys = await this.getSenderKeys();
      const recipientKeys = await this.getRecipientKeys();

      if (senderKeys && recipientKeys) {
        // Encrypt content with E2E encryption
        this.encryptedContent = await encryptionService.e2eEncryptMessage(
          this._decryptedContent,
          recipientKeys.publicKey,
          senderKeys.privateKey
        );
        this.isEncrypted = true;
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Instance methods
MessageSchema.methods.decryptContent = async function (userKeys) {
  try {
    if (!this.isEncrypted || !this.encryptedContent) {
      return this._decryptedContent || '';
    }

    let senderPublicKey, recipientPrivateKey;

    // Determine which keys to use based on current user
    if (this.sender.toString() === userKeys.userId) {
      // Current user is sender
      senderPublicKey = userKeys.publicKey;
      recipientPrivateKey = userKeys.privateKey; // Will need recipient's key
    } else {
      // Current user is recipient
      recipientPrivateKey = userKeys.privateKey;
      // Need to get sender's public key
    }

    const decryptedContent = await encryptionService.e2eDecryptMessage(
      this.encryptedContent,
      senderPublicKey,
      recipientPrivateKey
    );

    this._decryptedContent = decryptedContent;
    return decryptedContent;
  } catch (error) {
    throw new Error('Failed to decrypt message content');
  }
};

MessageSchema.methods.getSenderKeys = async function () {
  // This would retrieve encryption keys for the sender
  // Implementation depends on your key management system
  const User = mongoose.model('User');
  const sender = await User.findById(this.sender);
  return sender ? sender.encryptionKeys : null;
};

MessageSchema.methods.getRecipientKeys = async function () {
  // This would retrieve encryption keys for the recipient
  const User = mongoose.model('User');
  const recipient = await User.findById(this.recipient);
  return recipient ? recipient.encryptionKeys : null;
};

MessageSchema.methods.markAsRead = function (userId, deviceInfo = 'unknown') {
  if (this.readReceipts.some(receipt => receipt.user.toString() === userId.toString())) {
    return false; // Already marked as read
  }

  const now = new Date();
  
  this.readReceipts.push({
    user: userId,
    readAt: now,
    deviceInfo
  });

  if (this.recipient.toString() === userId.toString()) {
    this.readAt = now;
    this.status = 'read';
    
    // Add to status history
    this.statusHistory.push({
      status: 'read',
      timestamp: now,
      metadata: { readBy: userId, deviceInfo }
    });
  }

  return this.save({ validateBeforeSave: false });
};

MessageSchema.methods.markAsDelivered = function (metadata = {}) {
  if (this.status === 'sent' || this.status === 'sending') {
    const now = new Date();
    this.status = 'delivered';
    this.deliveredAt = now;
    this.deliveryAttempts = (this.deliveryAttempts || 0) + 1;
    this.lastDeliveryAttempt = now;
    
    // Add to status history
    this.statusHistory.push({
      status: 'delivered',
      timestamp: now,
      metadata
    });
    
    return this.save({ validateBeforeSave: false });
  }
  return Promise.resolve(this);
};

MessageSchema.methods.markAsSent = function (metadata = {}) {
  if (this.status === 'sending') {
    const now = new Date();
    this.status = 'sent';
    this.sentAt = now;
    
    // Add to status history
    this.statusHistory.push({
      status: 'sent',
      timestamp: now,
      metadata
    });
    
    return this.save({ validateBeforeSave: false });
  }
  return Promise.resolve(this);
};

MessageSchema.methods.markAsFailed = function (reason = 'unknown', metadata = {}) {
  const now = new Date();
  this.status = 'failed';
  this.failureReason = reason;
  this.deliveryAttempts = (this.deliveryAttempts || 0) + 1;
  this.lastDeliveryAttempt = now;
  
  // Add to status history
  this.statusHistory.push({
    status: 'failed',
    timestamp: now,
    metadata: { reason, ...metadata }
  });
  
  return this.save({ validateBeforeSave: false });
};

MessageSchema.methods.getStatusInfo = function () {
  return {
    messageId: this._id,
    status: this.status,
    sentAt: this.sentAt,
    deliveredAt: this.deliveredAt,
    readAt: this.readAt,
    deliveryAttempts: this.deliveryAttempts,
    failureReason: this.failureReason,
    readBy: this.readReceipts.map(r => ({
      user: r.user,
      readAt: r.readAt,
      deviceInfo: r.deviceInfo
    })),
    statusHistory: this.statusHistory,
    timings: {
      deliveryTime: this.deliveredAt ? this.deliveredAt.getTime() - this.sentAt.getTime() : null,
      readTime: this.readAt ? this.readAt.getTime() - this.sentAt.getTime() : null
    }
  };
};

MessageSchema.methods.addReaction = function (userId, emoji) {
  // Remove existing reaction from this user
  this.reactions = this.reactions.filter(
    reaction => reaction.user.toString() !== userId.toString()
  );

  // Add new reaction
  this.reactions.push({
    user: userId,
    emoji: emoji
  });

  return this.save({ validateBeforeSave: false });
};

MessageSchema.methods.removeReaction = function (userId) {
  this.reactions = this.reactions.filter(
    reaction => reaction.user.toString() !== userId.toString()
  );

  return this.save({ validateBeforeSave: false });
};

MessageSchema.methods.editContent = async function (newContent, userKeys) {
  try {
    // Save current content to edit history
    this.editHistory.push({
      encryptedContent: this.encryptedContent,
      editedAt: new Date()
    });

    // Encrypt new content
    const recipientKeys = await this.getRecipientKeys();
    const senderKeys = await this.getSenderKeys();

    if (senderKeys && recipientKeys) {
      this.encryptedContent = await encryptionService.e2eEncryptMessage(
        newContent,
        recipientKeys.publicKey,
        senderKeys.privateKey
      );
    }

    this.isEdited = true;
    this.updatedAt = new Date();

    return this.save();
  } catch (error) {
    throw new Error('Failed to edit message');
  }
};

MessageSchema.methods.deleteForUser = function (userId, deleteType = 'for_me') {
  if (deleteType === 'for_everyone') {
    // Only sender can delete for everyone within 24 hours
    if (this.sender.toString() === userId.toString()) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (this.createdAt > twentyFourHoursAgo) {
        this.visibility = 'deleted_for_everyone';
        this.deletedAt = new Date();
        this.deletedBy = userId;
        return this.save({ validateBeforeSave: false });
      }
    }
    return Promise.reject(new Error('Cannot delete for everyone'));
  } else {
    // Delete for current user only
    if (this.sender.toString() === userId.toString()) {
      this.visibility = 'deleted_for_sender';
    } else if (this.recipient.toString() === userId.toString()) {
      this.visibility = 'deleted_for_recipient';
    }

    this.deletedAt = new Date();
    return this.save({ validateBeforeSave: false });
  }
};

MessageSchema.methods.canUserView = function (userId) {
  if (this.visibility === 'deleted_for_everyone') {
    return false;
  }

  if (this.sender.toString() === userId.toString() && this.visibility === 'deleted_for_sender') {
    return false;
  }

  if (
    this.recipient.toString() === userId.toString() &&
    this.visibility === 'deleted_for_recipient'
  ) {
    return false;
  }

  return (
    this.sender.toString() === userId.toString() || this.recipient.toString() === userId.toString()
  );
};

MessageSchema.methods.setExpiration = function (expirationTime) {
  this.expiresAt = new Date(Date.now() + expirationTime);
  return this.save({ validateBeforeSave: false });
};

// Static methods
MessageSchema.statics.getConversation = function (userId1, userId2, limit = 50, page = 1) {
  const conversationId = [userId1, userId2].sort().join(':');

  return this.find({
    conversationId: conversationId,
    $or: [
      { visibility: 'visible' },
      {
        visibility: 'deleted_for_sender',
        sender: { $ne: userId1 }
      },
      {
        visibility: 'deleted_for_recipient',
        recipient: { $ne: userId1 }
      }
    ]
  })
    .populate('sender', 'username firstName lastName profilePicture')
    .populate('recipient', 'username firstName lastName profilePicture')
    .populate('replyTo')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit);
};

MessageSchema.statics.getUserConversations = function (userId) {
  return this.aggregate([
    {
      $match: {
        $or: [{ sender: userId }, { recipient: userId }],
        visibility: { $ne: 'deleted_for_everyone' }
      }
    },
    {
      $sort: { createdAt: -1 }
    },
    {
      $group: {
        _id: '$conversationId',
        lastMessage: { $first: '$$ROOT' },
        unreadCount: {
          $sum: {
            $cond: [
              {
                $and: [{ $eq: ['$recipient', userId] }, { $ne: ['$status', 'read'] }]
              },
              1,
              0
            ]
          }
        }
      }
    },
    {
      $sort: { 'lastMessage.createdAt': -1 }
    }
  ]);
};

MessageSchema.statics.markConversationAsRead = function (userId1, userId2, readerId) {
  const conversationId = [userId1, userId2].sort().join(':');

  return this.updateMany(
    {
      conversationId: conversationId,
      recipient: readerId,
      status: { $ne: 'read' }
    },
    {
      $set: {
        status: 'read',
        readAt: new Date()
      },
      $push: {
        readReceipts: {
          user: readerId,
          readAt: new Date()
        }
      }
    }
  );
};

MessageSchema.statics.getUnreadCount = function (userId) {
  return this.countDocuments({
    recipient: userId,
    status: { $ne: 'read' },
    visibility: { $ne: 'deleted_for_everyone' }
  });
};

MessageSchema.statics.searchMessages = function (userId, searchQuery, limit = 20) {
  return this.find({
    $or: [{ sender: userId }, { recipient: userId }],
    // Note: Cannot search encrypted content directly
    // This would need to be implemented in application layer after decryption
    messageType: 'text',
    visibility: { $ne: 'deleted_for_everyone' }
  })
    .populate('sender', 'username firstName lastName')
    .populate('recipient', 'username firstName lastName')
    .sort({ createdAt: -1 })
    .limit(limit);
};

module.exports = mongoose.model('Message', MessageSchema);
