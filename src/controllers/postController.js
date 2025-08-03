const Post = require('../models/Post');
const User = require('../models/User');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Validation helper
const validateObjectId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('Invalid ObjectId format');
  }
  return new mongoose.Types.ObjectId(id);
};

// @desc    Create new post
// @route   POST /api/posts
// @access  Private
exports.createPost = async (req, res) => {
  try {
    const { content, mediaUrls, tags, location, visibility } = req.body;

    const post = await Post.create({
      author: req.user.id,
      content,
      mediaUrls: mediaUrls || [],
      tags: tags || [],
      location,
      visibility: visibility || 'public'
    });

    await post.populate('author', 'username firstName lastName profilePicture');

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: post
    });
  } catch (error) {
    logger.error('Create post error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create post'
    });
  }
};

// @desc    Get all posts (timeline/feed)
// @route   GET /api/posts
// @access  Private
exports.getPosts = async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = '-createdAt' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get user's friends to show their posts in timeline
    const user = await User.findById(req.user.id);
    const friendIds = user.friends
      .filter(friend => friend.status === 'accepted')
      .map(friend => friend.user);

    // Include user's own posts and friends' posts
    const authorIds = [req.user.id, ...friendIds];

    const posts = await Post.find({
      $and: [
        { author: { $in: authorIds } },
        {
          $or: [
            { visibility: 'public' },
            { visibility: 'friends' },
            { author: req.user.id } // Always show own posts
          ]
        }
      ]
    })
      .populate('author', 'username firstName lastName profilePicture')
      .populate('comments.author', 'username firstName lastName profilePicture')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Post.countDocuments({
      $and: [
        { author: { $in: authorIds } },
        {
          $or: [{ visibility: 'public' }, { visibility: 'friends' }, { author: req.user.id }]
        }
      ]
    });

    res.status(200).json({
      success: true,
      data: {
        posts,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          count: posts.length,
          totalPosts: total
        }
      }
    });
  } catch (error) {
    logger.error('Get posts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get posts'
    });
  }
};

// @desc    Get trending posts
// @route   GET /api/posts/trending
// @access  Private
exports.getTrendingPosts = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get posts from last 7 days with high engagement
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const posts = await Post.find({
      createdAt: { $gte: sevenDaysAgo },
      visibility: 'public'
    })
      .populate('author', 'username firstName lastName profilePicture')
      .sort({ engagementScore: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        posts,
        pagination: {
          current: parseInt(page),
          count: posts.length
        }
      }
    });
  } catch (error) {
    logger.error('Get trending posts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get trending posts'
    });
  }
};

// @desc    Get posts by user
// @route   GET /api/posts/user/:userId
// @access  Private
exports.getPostsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    // Validate inputs
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format'
      });
    }
    
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit))); // Limit max 50
    const skip = (pageNum - 1) * limitNum;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check privacy and friendship status
    const currentUser = await User.findById(req.user.id);
    const isFriend = currentUser.friends.some(
      friend => friend.user.toString() === userId && friend.status === 'accepted'
    );
    const isOwner = userId === req.user.id;

    // Determine visibility filter
    let visibilityFilter = { visibility: 'public' };
    if (isOwner) {
      visibilityFilter = {}; // Show all posts for owner
    } else if (isFriend) {
      visibilityFilter = {
        $or: [{ visibility: 'public' }, { visibility: 'friends' }]
      };
    }

    const posts = await Post.find({
      author: userId,
      ...visibilityFilter
    })
      .populate('author', 'username firstName lastName profilePicture')
      .populate('comments.author', 'username firstName lastName profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Post.countDocuments({
      author: userId,
      ...visibilityFilter
    });

    res.status(200).json({
      success: true,
      data: {
        posts,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          count: posts.length,
          totalPosts: total
        }
      }
    });
  } catch (error) {
    logger.error('Get posts by user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user posts'
    });
  }
};

// @desc    Get single post
// @route   GET /api/posts/:postId
// @access  Private
exports.getPost = async (req, res) => {
  try {
    const { postId } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid post ID format'
      });
    }

    const post = await Post.findById(postId)
      .populate('author', 'username firstName lastName profilePicture')
      .populate('comments.author', 'username firstName lastName profilePicture')
      .populate('comments.replies.author', 'username firstName lastName profilePicture');

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    // Check if user can view this post
    const currentUser = await User.findById(req.user.id);
    const isFriend = currentUser.friends.some(
      friend =>
        friend.user.toString() === post.author._id.toString() && friend.status === 'accepted'
    );
    const isOwner = post.author._id.toString() === req.user.id;

    if (post.visibility === 'private' && !isOwner) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (post.visibility === 'friends' && !isFriend && !isOwner) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: post
    });
  } catch (error) {
    logger.error('Get post error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get post'
    });
  }
};

// @desc    Update post
// @route   PUT /api/posts/:postId
// @access  Private
exports.updatePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content, mediaUrls, tags, location, visibility } = req.body;

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    // Check if user owns the post
    if (post.author.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this post'
      });
    }

    // Update post
    post.content = content || post.content;
    post.mediaUrls = mediaUrls || post.mediaUrls;
    post.tags = tags || post.tags;
    post.location = location || post.location;
    post.visibility = visibility || post.visibility;
    post.updatedAt = Date.now();

    await post.save();
    await post.populate('author', 'username firstName lastName profilePicture');

    res.status(200).json({
      success: true,
      message: 'Post updated successfully',
      data: post
    });
  } catch (error) {
    logger.error('Update post error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update post'
    });
  }
};

// @desc    Delete post
// @route   DELETE /api/posts/:postId
// @access  Private
exports.deletePost = async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    // Check if user owns the post or is admin
    if (post.author.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this post'
      });
    }

    await Post.findByIdAndDelete(postId);

    res.status(200).json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    logger.error('Delete post error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete post'
    });
  }
};

// @desc    Like/Unlike post
// @route   POST /api/posts/:postId/like
// @access  Private
exports.toggleLike = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    const likeIndex = post.likes.indexOf(userId);
    let action = '';

    if (likeIndex === -1) {
      // Like the post
      post.likes.push(userId);
      action = 'liked';
    } else {
      // Unlike the post
      post.likes.splice(likeIndex, 1);
      action = 'unliked';
    }

    // Update engagement score
    post.updateEngagementScore();
    await post.save();

    res.status(200).json({
      success: true,
      message: `Post ${action} successfully`,
      data: {
        likesCount: post.likes.length,
        isLiked: action === 'liked'
      }
    });
  } catch (error) {
    logger.error('Toggle like error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle like'
    });
  }
};

// @desc    Share post
// @route   POST /api/posts/:postId/share
// @access  Private
exports.sharePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;

    const originalPost = await Post.findById(postId);

    if (!originalPost) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    // Create a new share post
    const sharePost = await Post.create({
      author: req.user.id,
      content: content || '',
      sharedPost: postId,
      visibility: 'public'
    });

    // Increment share count on original post
    originalPost.shares += 1;
    originalPost.updateEngagementScore();
    await originalPost.save();

    await sharePost.populate([
      { path: 'author', select: 'username firstName lastName profilePicture' },
      {
        path: 'sharedPost',
        populate: {
          path: 'author',
          select: 'username firstName lastName profilePicture'
        }
      }
    ]);

    res.status(201).json({
      success: true,
      message: 'Post shared successfully',
      data: sharePost
    });
  } catch (error) {
    logger.error('Share post error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to share post'
    });
  }
};

// @desc    Report post
// @route   POST /api/posts/:postId/report
// @access  Private
exports.reportPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { reason, description } = req.body;

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    // Check if user already reported this post
    const existingReport = post.reports.find(
      report => report.reportedBy.toString() === req.user.id
    );

    if (existingReport) {
      return res.status(400).json({
        success: false,
        error: 'You have already reported this post'
      });
    }

    // Add report
    post.reports.push({
      reportedBy: req.user.id,
      reason,
      description: description || '',
      createdAt: new Date()
    });

    await post.save();

    // Log for moderation
    logger.warn(`Post reported: ${postId} by user ${req.user.username}`, {
      postId,
      reporterId: req.user.id,
      reason,
      description
    });

    res.status(200).json({
      success: true,
      message: 'Post reported successfully'
    });
  } catch (error) {
    logger.error('Report post error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to report post'
    });
  }
};
