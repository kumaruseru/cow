const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema(
  {
    // Author information
    author: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true
    },

    // Post content
    content: {
      type: String,
      required: [true, 'Post content is required'],
      maxlength: [5000, 'Post content cannot exceed 5000 characters'],
      trim: true
    },

    // Media attachments
    media: [
      {
        type: {
          type: String,
          enum: ['image', 'video', 'document'],
          required: true
        },
        url: {
          type: String,
          required: true
        },
        publicId: String, // For Cloudinary
        filename: String,
        size: Number,
        mimeType: String,
        alt: String, // Alternative text for accessibility
        thumbnail: String // Thumbnail URL for videos
      }
    ],

    // Post metadata
    visibility: {
      type: String,
      enum: ['public', 'friends', 'private'],
      default: 'friends'
    },

    tags: [
      {
        type: String,
        maxlength: 50,
        trim: true
      }
    ],

    mentions: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      }
    ],

    location: {
      name: String,
      coordinates: {
        type: [Number] // [longitude, latitude]
      }
    },

    feeling: {
      type: String,
      maxlength: 50
    },

    // Engagement
    likes: [
      {
        user: {
          type: mongoose.Schema.ObjectId,
          ref: 'User',
          required: true
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ],

    comments: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'Comment'
      }
    ],

    shares: [
      {
        user: {
          type: mongoose.Schema.ObjectId,
          ref: 'User',
          required: true
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ],

    // Statistics
    stats: {
      likesCount: {
        type: Number,
        default: 0
      },
      commentsCount: {
        type: Number,
        default: 0
      },
      sharesCount: {
        type: Number,
        default: 0
      },
      viewsCount: {
        type: Number,
        default: 0
      }
    },

    // Post status
    isEdited: {
      type: Boolean,
      default: false
    },

    editHistory: [
      {
        content: String,
        editedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],

    isReported: {
      type: Boolean,
      default: false
    },

    reports: [
      {
        user: {
          type: mongoose.Schema.ObjectId,
          ref: 'User'
        },
        reason: {
          type: String,
          enum: [
            'spam',
            'harassment',
            'hate_speech',
            'violence',
            'adult_content',
            'misinformation',
            'other'
          ]
        },
        description: String,
        reportedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],

    isActive: {
      type: Boolean,
      default: true
    },

    moderationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'under_review'],
      default: 'approved'
    },

    // Algorithm and recommendation data
    engagementScore: {
      type: Number,
      default: 0
    },

    trending: {
      score: {
        type: Number,
        default: 0
      },
      lastCalculated: {
        type: Date,
        default: Date.now
      }
    },

    // Advanced features
    poll: {
      question: String,
      options: [
        {
          text: String,
          votes: [
            {
              user: {
                type: mongoose.Schema.ObjectId,
                ref: 'User'
              },
              votedAt: {
                type: Date,
                default: Date.now
              }
            }
          ]
        }
      ],
      allowMultipleVotes: {
        type: Boolean,
        default: false
      },
      expiresAt: Date
    },

    event: {
      title: String,
      description: String,
      startDate: Date,
      endDate: Date,
      location: String,
      attendees: [
        {
          user: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
          },
          status: {
            type: String,
            enum: ['going', 'maybe', 'not_going'],
            default: 'going'
          },
          respondedAt: {
            type: Date,
            default: Date.now
          }
        }
      ]
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better performance
PostSchema.index({ author: 1, createdAt: -1 });
PostSchema.index({ createdAt: -1 });
PostSchema.index({ visibility: 1 });
PostSchema.index({ tags: 1 });
PostSchema.index({ 'location.coordinates': '2dsphere' });
PostSchema.index({ engagementScore: -1 });
PostSchema.index({ 'trending.score': -1 });

// Virtual for like status (to be populated for specific user)
PostSchema.virtual('isLiked').get(function () {
  return this._isLiked;
});

// Virtual for total engagement
PostSchema.virtual('totalEngagement').get(function () {
  return this.stats.likesCount + this.stats.commentsCount + this.stats.sharesCount;
});

// Calculate engagement score before saving
PostSchema.pre('save', function (next) {
  if (this.isModified('stats')) {
    const ageInHours = (Date.now() - this.createdAt) / (1000 * 60 * 60);
    const decayFactor = Math.exp(-0.1 * ageInHours); // Exponential decay

    this.engagementScore =
      (this.stats.likesCount * 1 + this.stats.commentsCount * 2 + this.stats.sharesCount * 3) *
      decayFactor;
  }
  next();
});

// Update author's post count when post is created
PostSchema.post('save', async function (doc) {
  if (this.isNew) {
    await mongoose.model('User').findByIdAndUpdate(doc.author, { $inc: { 'stats.postsCount': 1 } });
  }
});

// Update author's post count when post is deleted
PostSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    await mongoose
      .model('User')
      .findByIdAndUpdate(doc.author, { $inc: { 'stats.postsCount': -1 } });
  }
});

// Instance methods
PostSchema.methods.addLike = function (userId) {
  const existingLike = this.likes.find(like => like.user.toString() === userId.toString());

  if (!existingLike) {
    this.likes.push({ user: userId });
    this.stats.likesCount += 1;
    return true; // Like added
  }
  return false; // Already liked
};

PostSchema.methods.removeLike = function (userId) {
  const initialLength = this.likes.length;
  this.likes = this.likes.filter(like => like.user.toString() !== userId.toString());

  if (this.likes.length < initialLength) {
    this.stats.likesCount = Math.max(0, this.stats.likesCount - 1);
    return true; // Like removed
  }
  return false; // Not liked
};

PostSchema.methods.addShare = function (userId) {
  const existingShare = this.shares.find(share => share.user.toString() === userId.toString());

  if (!existingShare) {
    this.shares.push({ user: userId });
    this.stats.sharesCount += 1;
    return true; // Share added
  }
  return false; // Already shared
};

PostSchema.methods.incrementViews = function () {
  this.stats.viewsCount += 1;
  return this.save({ validateBeforeSave: false });
};

PostSchema.methods.addComment = function (commentId) {
  this.comments.push(commentId);
  this.stats.commentsCount += 1;
  return this.save({ validateBeforeSave: false });
};

PostSchema.methods.removeComment = function (commentId) {
  this.comments = this.comments.filter(id => id.toString() !== commentId.toString());
  this.stats.commentsCount = Math.max(0, this.stats.commentsCount - 1);
  return this.save({ validateBeforeSave: false });
};

PostSchema.methods.addReport = function (userId, reason, description) {
  const existingReport = this.reports.find(report => report.user.toString() === userId.toString());

  if (!existingReport) {
    this.reports.push({
      user: userId,
      reason,
      description
    });

    // Mark as reported if it gets multiple reports
    if (this.reports.length >= 3) {
      this.isReported = true;
      this.moderationStatus = 'under_review';
    }

    return true;
  }
  return false;
};

PostSchema.methods.canViewPost = function (userId, userRole = 'user') {
  // Admin and moderators can view all posts
  if (userRole === 'admin' || userRole === 'moderator') {
    return true;
  }

  // Author can always view their own posts
  if (this.author.toString() === userId?.toString()) {
    return true;
  }

  // Check if post is active
  if (!this.isActive) {
    return false;
  }

  // Check visibility
  if (this.visibility === 'public') {
    return true;
  }

  if (this.visibility === 'private') {
    return false;
  }

  // For 'friends' visibility, you would need to check friendship status
  // This would require the User model to check if users are friends
  return false; // Default to no access for friends-only posts
};

PostSchema.methods.canEditPost = function (userId, userRole = 'user') {
  // Admin and moderators can edit posts
  if (userRole === 'admin' || userRole === 'moderator') {
    return true;
  }

  // Only author can edit their posts within 24 hours
  if (this.author.toString() === userId?.toString()) {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.createdAt > twentyFourHoursAgo;
  }

  return false;
};

PostSchema.methods.updateContent = function (newContent) {
  // Save current content to edit history
  this.editHistory.push({
    content: this.content,
    editedAt: new Date()
  });

  this.content = newContent;
  this.isEdited = true;
  this.updatedAt = new Date();

  return this.save();
};

// Static methods
PostSchema.statics.findByVisibility = function (visibility, userId) {
  const query = { visibility, isActive: true };

  if (userId) {
    // Include user's own posts regardless of visibility
    query.$or = [
      { visibility, isActive: true },
      { author: userId, isActive: true }
    ];
  }

  return this.find(query)
    .populate('author', 'username firstName lastName profilePicture')
    .populate('comments')
    .sort({ createdAt: -1 });
};

PostSchema.statics.findTrending = function (limit = 10) {
  return this.find({
    isActive: true,
    visibility: 'public'
  })
    .sort({ 'trending.score': -1, engagementScore: -1 })
    .limit(limit)
    .populate('author', 'username firstName lastName profilePicture');
};

PostSchema.statics.findByAuthor = function (authorId, viewerId = null) {
  const query = { author: authorId, isActive: true };

  // If viewing own posts, show all
  if (viewerId && viewerId.toString() === authorId.toString()) {
    // Show all posts including private ones
  } else {
    // Show only public and friends posts
    query.visibility = { $in: ['public', 'friends'] };
  }

  return this.find(query)
    .populate('author', 'username firstName lastName profilePicture')
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model('Post', PostSchema);
