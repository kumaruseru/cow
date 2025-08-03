const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  content: {
    type: String,
    required: [true, 'Post content is required'],
    trim: true,
    maxlength: [500, 'Post content cannot exceed 500 characters']
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  privacy: {
    type: String,
    enum: ['public', 'private', 'friends'],
    default: 'public'
  },
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, 'Comment cannot exceed 200 characters']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  images: [{
    url: String,
    caption: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  location: {
    place_id: String,
    name: String,
    address: String,
    lat: Number,
    lng: Number,
    types: [String]
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  reportCount: {
    type: Number,
    default: 0
  },
  editHistory: [{
    content: String,
    editedAt: {
      type: Date,
      default: Date.now
    }
  }],
  shares: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
PostSchema.index({ author: 1, createdAt: -1 });
PostSchema.index({ privacy: 1, createdAt: -1 });
PostSchema.index({ isActive: 1, createdAt: -1 });
PostSchema.index({ tags: 1 });
PostSchema.index({ 'likes.user': 1 });

// Virtual for like count
PostSchema.virtual('likeCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

// Virtual for comment count
PostSchema.virtual('commentCount').get(function() {
  return this.comments ? this.comments.length : 0;
});

// Virtual for checking if post is liked by a specific user
PostSchema.methods.isLikedBy = function(userId) {
  return this.likes.some(like => like.user.toString() === userId.toString());
};

// Method to add like
PostSchema.methods.addLike = function(userId) {
  if (!this.isLikedBy(userId)) {
    this.likes.push({ user: userId });
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to remove like
PostSchema.methods.removeLike = function(userId) {
  this.likes = this.likes.filter(like => like.user.toString() !== userId.toString());
  return this.save();
};

// Method to add comment
PostSchema.methods.addComment = function(userId, content) {
  this.comments.push({
    user: userId,
    content: content.trim()
  });
  return this.save();
};

// Method to remove comment
PostSchema.methods.removeComment = function(commentId) {
  this.comments = this.comments.filter(comment => comment._id.toString() !== commentId.toString());
  return this.save();
};

// Static methods
PostSchema.statics.getPublicPosts = function(page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  return this.find({ privacy: 'public', isActive: true })
    .populate('author', 'username avatar')
    .populate('comments.user', 'username avatar')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

PostSchema.statics.getUserPosts = function(userId, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  return this.find({ author: userId, isActive: true })
    .populate('author', 'username avatar')
    .populate('comments.user', 'username avatar')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

PostSchema.statics.searchPosts = function(query, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  return this.find({
    $and: [
      { privacy: 'public', isActive: true },
      {
        $or: [
          { content: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } }
        ]
      }
    ]
  })
  .populate('author', 'username avatar')
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(limit);
};

// Pre-save middleware to extract hashtags
PostSchema.pre('save', function(next) {
  if (this.isModified('content')) {
    // Extract hashtags from content
    const hashtags = this.content.match(/#\w+/g);
    if (hashtags) {
      this.tags = hashtags.map(tag => tag.substring(1).toLowerCase());
    }
  }
  next();
});

module.exports = mongoose.model('Post', PostSchema);
