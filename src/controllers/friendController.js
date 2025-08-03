const User = require('../models/User');
const logger = require('../utils/logger');

// @desc    Send friend request
// @route   POST /api/friends/request/:userId
// @access  Private
const sendFriendRequest = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    if (userId === currentUserId.toString()) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot send friend request to yourself'
      });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const currentUser = await User.findById(currentUserId);

    // Check if already friends
    if (currentUser.friends.includes(userId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Already friends with this user'
      });
    }

    // Check if request already sent
    if (currentUser.friendRequestsSent.includes(userId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Friend request already sent'
      });
    }

    // Check if request already received
    if (currentUser.friendRequestsReceived.includes(userId)) {
      return res.status(400).json({
        status: 'error',
        message: 'This user has already sent you a friend request'
      });
    }

    // Check if user is blocked
    if (
      currentUser.blockedUsers.includes(userId) ||
      targetUser.blockedUsers.includes(currentUserId)
    ) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot send friend request to this user'
      });
    }

    // Send friend request
    currentUser.friendRequestsSent.push(userId);
    targetUser.friendRequestsReceived.push(currentUserId);

    await Promise.all([currentUser.save(), targetUser.save()]);

    logger.info(`Friend request sent from ${currentUserId} to ${userId}`);

    res.status(201).json({
      status: 'success',
      message: 'Friend request sent successfully'
    });
  } catch (error) {
    logger.error('Error sending friend request:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// @desc    Accept friend request
// @route   POST /api/friends/accept/:userId
// @access  Private
const acceptFriendRequest = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    const currentUser = await User.findById(currentUserId);
    const requestingUser = await User.findById(userId);

    if (!requestingUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Check if friend request exists
    if (!currentUser.friendRequestsReceived.includes(userId)) {
      return res.status(400).json({
        status: 'error',
        message: 'No friend request from this user'
      });
    }

    // Remove from requests and add to friends
    currentUser.friendRequestsReceived.pull(userId);
    requestingUser.friendRequestsSent.pull(currentUserId);

    currentUser.friends.push(userId);
    requestingUser.friends.push(currentUserId);

    await Promise.all([currentUser.save(), requestingUser.save()]);

    logger.info(`Friend request accepted: ${userId} and ${currentUserId} are now friends`);

    res.json({
      status: 'success',
      message: 'Friend request accepted',
      data: {
        friend: {
          _id: requestingUser._id,
          username: requestingUser.username,
          firstName: requestingUser.firstName,
          lastName: requestingUser.lastName,
          avatar: requestingUser.avatar
        }
      }
    });
  } catch (error) {
    logger.error('Error accepting friend request:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// @desc    Reject friend request
// @route   POST /api/friends/reject/:userId
// @access  Private
const rejectFriendRequest = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    const currentUser = await User.findById(currentUserId);
    const requestingUser = await User.findById(userId);

    if (!requestingUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Check if friend request exists
    if (!currentUser.friendRequestsReceived.includes(userId)) {
      return res.status(400).json({
        status: 'error',
        message: 'No friend request from this user'
      });
    }

    // Remove from requests
    currentUser.friendRequestsReceived.pull(userId);
    requestingUser.friendRequestsSent.pull(currentUserId);

    await Promise.all([currentUser.save(), requestingUser.save()]);

    logger.info(`Friend request rejected: ${currentUserId} rejected ${userId}`);

    res.json({
      status: 'success',
      message: 'Friend request rejected'
    });
  } catch (error) {
    logger.error('Error rejecting friend request:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// @desc    Remove friend
// @route   DELETE /api/friends/:userId
// @access  Private
const removeFriend = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    const currentUser = await User.findById(currentUserId);
    const friendUser = await User.findById(userId);

    if (!friendUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Check if they are friends
    if (!currentUser.friends.includes(userId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Not friends with this user'
      });
    }

    // Remove from friends
    currentUser.friends.pull(userId);
    friendUser.friends.pull(currentUserId);

    await Promise.all([currentUser.save(), friendUser.save()]);

    logger.info(`Friendship removed: ${currentUserId} and ${userId}`);

    res.json({
      status: 'success',
      message: 'Friend removed successfully'
    });
  } catch (error) {
    logger.error('Error removing friend:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// @desc    Get friends list
// @route   GET /api/friends
// @access  Private
const getFriends = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const user = await User.findById(userId).populate({
      path: 'friends',
      select: 'username firstName lastName avatar isOnline lastSeen',
      options: {
        skip,
        limit,
        sort: { firstName: 1 }
      }
    });

    const totalFriends = await User.findById(userId).select('friends');
    const total = totalFriends.friends.length;

    res.json({
      status: 'success',
      data: {
        friends: user.friends,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalFriends: total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching friends:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// @desc    Get friend requests received
// @route   GET /api/friends/requests/received
// @access  Private
const getFriendRequestsReceived = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const user = await User.findById(userId).populate({
      path: 'friendRequestsReceived',
      select: 'username firstName lastName avatar',
      options: {
        skip,
        limit,
        sort: { createdAt: -1 }
      }
    });

    const totalRequests = await User.findById(userId).select('friendRequestsReceived');
    const total = totalRequests.friendRequestsReceived.length;

    res.json({
      status: 'success',
      data: {
        requests: user.friendRequestsReceived,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalRequests: total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching friend requests:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// @desc    Get friend requests sent
// @route   GET /api/friends/requests/sent
// @access  Private
const getFriendRequestsSent = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const user = await User.findById(userId).populate({
      path: 'friendRequestsSent',
      select: 'username firstName lastName avatar',
      options: {
        skip,
        limit,
        sort: { createdAt: -1 }
      }
    });

    const totalRequests = await User.findById(userId).select('friendRequestsSent');
    const total = totalRequests.friendRequestsSent.length;

    res.json({
      status: 'success',
      data: {
        requests: user.friendRequestsSent,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalRequests: total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching sent friend requests:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// @desc    Get friend suggestions
// @route   GET /api/friends/suggestions
// @access  Private
const getFriendSuggestions = async (req, res) => {
  try {
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 10;

    const currentUser = await User.findById(userId);

    // Get users who are not friends, not blocked, and haven't sent/received requests
    const excludeIds = [
      userId,
      ...currentUser.friends,
      ...currentUser.blockedUsers,
      ...currentUser.friendRequestsSent,
      ...currentUser.friendRequestsReceived
    ];

    const suggestions = await User.find({
      _id: { $nin: excludeIds },
      isActive: true
    })
      .select('username firstName lastName avatar mutualFriendsCount')
      .limit(limit)
      .sort({ mutualFriendsCount: -1, createdAt: -1 });

    res.json({
      status: 'success',
      data: { suggestions }
    });
  } catch (error) {
    logger.error('Error fetching friend suggestions:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// @desc    Check friendship status
// @route   GET /api/friends/status/:userId
// @access  Private
const getFriendshipStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    if (userId === currentUserId.toString()) {
      return res.json({
        status: 'success',
        data: { relationship: 'self' }
      });
    }

    const currentUser = await User.findById(currentUserId);

    let relationship = 'none';

    if (currentUser.friends.includes(userId)) {
      relationship = 'friends';
    } else if (currentUser.friendRequestsSent.includes(userId)) {
      relationship = 'request_sent';
    } else if (currentUser.friendRequestsReceived.includes(userId)) {
      relationship = 'request_received';
    } else if (currentUser.blockedUsers.includes(userId)) {
      relationship = 'blocked';
    }

    res.json({
      status: 'success',
      data: { relationship }
    });
  } catch (error) {
    logger.error('Error checking friendship status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

module.exports = {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  getFriends,
  getFriendRequestsReceived,
  getFriendRequestsSent,
  getFriendSuggestions,
  getFriendshipStatus
};
