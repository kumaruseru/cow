const User = require('../models/User');
const logger = require('../utils/logger');
const crypto = require('crypto');

// @desc    Get current user profile
// @route   GET /api/users/profile
// @access  Private
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -resetPasswordToken -resetPasswordExpire')
      .populate('friends.user', 'username firstName lastName profilePicture');

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user profile'
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const allowedFields = [
      'firstName',
      'lastName',
      'dateOfBirth',
      'bio',
      'location',
      'website',
      'phone',
      'profilePicture',
      'coverPhoto'
    ];

    const updateData = {};
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    });

    const user = await User.findByIdAndUpdate(req.user.id, updateData, {
      new: true,
      runValidators: true
    }).select('-password -resetPasswordToken -resetPasswordExpire');

    await user.logSecurityEvent({
      eventType: 'PROFILE_UPDATE',
      severity: 'low',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        updatedFields: Object.keys(updateData)
      }
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
};

// @desc    Update privacy settings
// @route   PUT /api/users/privacy-settings
// @access  Private
exports.updatePrivacySettings = async (req, res) => {
  try {
    const allowedSettings = [
      'profileVisibility',
      'friendsListVisibility',
      'postsVisibility',
      'allowFriendRequests',
      'allowMessages',
      'showOnlineStatus',
      'allowTagging',
      'allowLocationTracking'
    ];

    const updateData = {};
    Object.keys(req.body).forEach(key => {
      if (allowedSettings.includes(key)) {
        updateData[`privacySettings.${key}`] = req.body[key];
      }
    });

    const user = await User.findByIdAndUpdate(req.user.id, updateData, {
      new: true,
      runValidators: true
    }).select('privacySettings');

    await user.logSecurityEvent({
      eventType: 'PRIVACY_SETTINGS_UPDATE',
      severity: 'medium',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        updatedSettings: Object.keys(req.body)
      }
    });

    res.status(200).json({
      success: true,
      message: 'Privacy settings updated successfully',
      data: user.privacySettings
    });
  } catch (error) {
    logger.error('Update privacy settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update privacy settings'
    });
  }
};

// @desc    Search users
// @route   GET /api/users/search
// @access  Private
exports.searchUsers = async (req, res) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;

    // Sanitize and validate search query
    const sanitizedQuery = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    if (!q || sanitizedQuery.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters'
      });
    }

    if (sanitizedQuery.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Search query too long'
      });
    }

    const searchRegex = new RegExp(sanitizedQuery, 'i');
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find({
      $and: [
        {
          $or: [
            { username: searchRegex },
            { firstName: searchRegex },
            { lastName: searchRegex },
            {
              $expr: {
                $regexMatch: {
                  input: { $concat: ['$firstName', ' ', '$lastName'] },
                  regex: q.trim(),
                  options: 'i'
                }
              }
            }
          ]
        },
        { _id: { $ne: req.user.id } }, // Exclude current user
        { 'privacySettings.profileVisibility': { $ne: 'private' } }
      ]
    })
      .select('username firstName lastName profilePicture bio location')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ username: 1 });

    const total = await User.countDocuments({
      $and: [
        {
          $or: [
            { username: searchRegex },
            { firstName: searchRegex },
            { lastName: searchRegex },
            {
              $expr: {
                $regexMatch: {
                  input: { $concat: ['$firstName', ' ', '$lastName'] },
                  regex: q.trim(),
                  options: 'i'
                }
              }
            }
          ]
        },
        { _id: { $ne: req.user.id } },
        { 'privacySettings.profileVisibility': { $ne: 'private' } }
      ]
    });

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          count: users.length,
          totalUsers: total
        }
      }
    });
  } catch (error) {
    logger.error('Search users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search users'
    });
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:userId
// @access  Private
exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUser = req.user;

    const user = await User.findById(userId)
      .select('-password -resetPasswordToken -resetPasswordExpire -blockedUsers')
      .populate('friends.user', 'username firstName lastName profilePicture');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if current user is blocked
    if (user.blockedUsers.includes(currentUser.id)) {
      return res.status(403).json({
        success: false,
        error: 'User not accessible'
      });
    }

    // Check privacy settings
    const isOwner = user._id.toString() === currentUser.id;
    const isFriend = user.friends.some(
      friend => friend.user._id.toString() === currentUser.id && friend.status === 'accepted'
    );

    // Filter data based on privacy settings
    let userData = {
      _id: user._id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePicture: user.profilePicture,
      bio: user.bio,
      location: user.location,
      website: user.website,
      createdAt: user.createdAt,
      isOwner,
      isFriend
    };

    // Add additional data based on privacy settings
    if (
      isOwner ||
      user.privacySettings.profileVisibility === 'public' ||
      (user.privacySettings.profileVisibility === 'friends' && isFriend)
    ) {
      userData.coverPhoto = user.coverPhoto;
      userData.dateOfBirth = user.dateOfBirth;

      if (
        user.privacySettings.friendsListVisibility === 'public' ||
        (user.privacySettings.friendsListVisibility === 'friends' && isFriend) ||
        isOwner
      ) {
        userData.friendsCount = user.friends.filter(f => f.status === 'accepted').length;
      }
    }

    res.status(200).json({
      success: true,
      data: userData
    });
  } catch (error) {
    logger.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user'
    });
  }
};

// @desc    Block user
// @route   POST /api/users/block/:userId
// @access  Private
exports.blockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUser = req.user;

    if (userId === currentUser.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot block yourself'
      });
    }

    const userToBlock = await User.findById(userId);
    if (!userToBlock) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Add to blocked users if not already blocked
    if (!currentUser.blockedUsers.includes(userId)) {
      currentUser.blockedUsers.push(userId);

      // Remove from friends if they are friends
      currentUser.friends = currentUser.friends.filter(friend => friend.user.toString() !== userId);

      // Remove from the other user's friends list too
      userToBlock.friends = userToBlock.friends.filter(
        friend => friend.user.toString() !== currentUser.id
      );

      await currentUser.save({ validateBeforeSave: false });
      await userToBlock.save({ validateBeforeSave: false });

      // Log security event
      await currentUser.logSecurityEvent({
        eventType: 'USER_BLOCKED',
        severity: 'medium',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: {
          blockedUserId: userId,
          blockedUsername: userToBlock.username
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'User blocked successfully'
    });
  } catch (error) {
    logger.error('Block user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to block user'
    });
  }
};

// @desc    Unblock user
// @route   DELETE /api/users/block/:userId
// @access  Private
exports.unblockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUser = req.user;

    // Remove from blocked users
    currentUser.blockedUsers = currentUser.blockedUsers.filter(
      blockedId => blockedId.toString() !== userId
    );

    await currentUser.save({ validateBeforeSave: false });

    // Log security event
    await currentUser.logSecurityEvent({
      eventType: 'USER_UNBLOCKED',
      severity: 'low',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        unblockedUserId: userId
      }
    });

    res.status(200).json({
      success: true,
      message: 'User unblocked successfully'
    });
  } catch (error) {
    logger.error('Unblock user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unblock user'
    });
  }
};

// @desc    Get blocked users
// @route   GET /api/users/blocked
// @access  Private
exports.getBlockedUsers = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('blockedUsers', 'username firstName lastName profilePicture')
      .select('blockedUsers');

    res.status(200).json({
      success: true,
      data: user.blockedUsers
    });
  } catch (error) {
    logger.error('Get blocked users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get blocked users'
    });
  }
};

// @desc    Delete user account
// @route   DELETE /api/users/account
// @access  Private
exports.deleteAccount = async (req, res) => {
  try {
    const { password, confirmDelete } = req.body;
    const user = await User.findById(req.user.id).select('+password');

    if (confirmDelete !== 'DELETE_MY_ACCOUNT') {
      return res.status(400).json({
        success: false,
        error: 'Please confirm account deletion by typing "DELETE_MY_ACCOUNT"'
      });
    }

    // Verify password
    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password'
      });
    }

    // Log final security event
    await user.logSecurityEvent({
      eventType: 'ACCOUNT_DELETED',
      severity: 'high',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: {
        deletionTimestamp: new Date(),
        reason: 'User requested account deletion'
      }
    });

    // Delete user account
    await User.findByIdAndDelete(req.user.id);

    logger.info(`User account deleted: ${user.username} (${user.email})`);

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    logger.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete account'
    });
  }
};
