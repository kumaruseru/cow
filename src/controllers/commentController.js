const Comment = require('../models/Comment');
const Post = require('../models/Post');
const mongoose = require('mongoose');
const validator = require('validator');
const logger = require('../utils/logger');

// Input validation helper
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  return validator.escape(input.trim());
};

// @desc    Create new comment
// @route   POST /api/posts/:postId/comments
// @access  Private
const createComment = async (req, res) => {
  try {
    const { content } = req.body;
    const { postId } = req.params;
    const userId = req.user._id;

    // Validate inputs
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid post ID format'
      });
    }

    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        status: 'error',
        message: 'Comment content is required'
      });
    }

    const sanitizedContent = sanitizeInput(content);
    if (sanitizedContent.length < 1 || sanitizedContent.length > 2000) {
      return res.status(400).json({
        status: 'error',
        message: 'Comment must be between 1 and 2000 characters'
      });
    }

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found'
      });
    }

    // Create comment with sanitized content
    const comment = await Comment.create({
      content: sanitizedContent,
      post: postId,
      author: userId
    });

    await comment.populate('author', 'username avatar firstName lastName');

    // Update post comment count
    await Post.findByIdAndUpdate(postId, {
      $inc: { commentsCount: 1 }
    });

    logger.info(`Comment created: ${comment._id} by user: ${userId}`);

    res.status(201).json({
      status: 'success',
      data: { comment }
    });
  } catch (error) {
    logger.error('Error creating comment:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// @desc    Get comments for a post
// @route   GET /api/posts/:postId/comments
// @access  Public
const getCommentsByPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found'
      });
    }

    const comments = await Comment.find({ post: postId })
      .populate('author', 'username avatar firstName lastName')
      .populate('replies.author', 'username avatar firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Comment.countDocuments({ post: postId });

    res.json({
      status: 'success',
      data: {
        comments,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalComments: total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching comments:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// @desc    Update comment
// @route   PUT /api/comments/:commentId
// @access  Private
const updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.user._id;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        status: 'error',
        message: 'Comment not found'
      });
    }

    // Check if user is the author
    if (comment.author.toString() !== userId.toString()) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to update this comment'
      });
    }

    comment.content = content;
    comment.isEdited = true;
    comment.lastEditedAt = new Date();
    await comment.save();

    await comment.populate('author', 'username avatar firstName lastName');

    logger.info(`Comment updated: ${commentId} by user: ${userId}`);

    res.json({
      status: 'success',
      data: { comment }
    });
  } catch (error) {
    logger.error('Error updating comment:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// @desc    Delete comment
// @route   DELETE /api/comments/:commentId
// @access  Private
const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user._id;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        status: 'error',
        message: 'Comment not found'
      });
    }

    // Check if user is the author or admin
    if (comment.author.toString() !== userId.toString() && !req.user.roles.includes('admin')) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to delete this comment'
      });
    }

    // Update post comment count
    await Post.findByIdAndUpdate(comment.post, {
      $inc: { commentsCount: -1 }
    });

    await Comment.findByIdAndDelete(commentId);

    logger.info(`Comment deleted: ${commentId} by user: ${userId}`);

    res.json({
      status: 'success',
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting comment:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// @desc    Like/unlike comment
// @route   POST /api/comments/:commentId/like
// @access  Private
const toggleCommentLike = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user._id;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        status: 'error',
        message: 'Comment not found'
      });
    }

    const isLiked = comment.likes.includes(userId);

    if (isLiked) {
      comment.likes.pull(userId);
      comment.likesCount -= 1;
    } else {
      comment.likes.push(userId);
      comment.likesCount += 1;
    }

    await comment.save();

    logger.info(`Comment ${isLiked ? 'unliked' : 'liked'}: ${commentId} by user: ${userId}`);

    res.json({
      status: 'success',
      data: {
        isLiked: !isLiked,
        likesCount: comment.likesCount
      }
    });
  } catch (error) {
    logger.error('Error toggling comment like:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// @desc    Reply to comment
// @route   POST /api/comments/:commentId/reply
// @access  Private
const replyToComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.user._id;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        status: 'error',
        message: 'Comment not found'
      });
    }

    const reply = {
      content,
      author: userId,
      createdAt: new Date()
    };

    comment.replies.push(reply);
    comment.repliesCount += 1;
    await comment.save();

    await comment.populate('replies.author', 'username avatar firstName lastName');

    const newReply = comment.replies[comment.replies.length - 1];

    logger.info(`Reply created for comment: ${commentId} by user: ${userId}`);

    res.status(201).json({
      status: 'success',
      data: { reply: newReply }
    });
  } catch (error) {
    logger.error('Error creating reply:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// @desc    Report comment
// @route   POST /api/comments/:commentId/report
// @access  Private
const reportComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { reason, description } = req.body;
    const userId = req.user._id;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        status: 'error',
        message: 'Comment not found'
      });
    }

    // Check if user already reported this comment
    const existingReport = comment.reports.find(
      report => report.reporter.toString() === userId.toString()
    );

    if (existingReport) {
      return res.status(400).json({
        status: 'error',
        message: 'You have already reported this comment'
      });
    }

    comment.reports.push({
      reporter: userId,
      reason,
      description,
      reportedAt: new Date()
    });

    await comment.save();

    logger.info(`Comment reported: ${commentId} by user: ${userId} for: ${reason}`);

    res.json({
      status: 'success',
      message: 'Comment reported successfully'
    });
  } catch (error) {
    logger.error('Error reporting comment:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

module.exports = {
  createComment,
  getCommentsByPost,
  updateComment,
  deleteComment,
  toggleCommentLike,
  replyToComment,
  reportComment
};
