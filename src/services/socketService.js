const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');
const activityTrackingService = require('./activityTrackingService');

// Store connected users
const connectedUsers = new Map();

module.exports = io => {
  // Middleware for socket authentication
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      if (!user.isActive || user.isBanned) {
        return next(new Error('Authentication error: Account inactive or banned'));
      }

      socket.userId = user._id.toString();
      socket.username = user.username;
      socket.user = user;

      next();
    } catch (error) {
      logger.error('Socket authentication error:', error.message);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async socket => {
    logger.info(`User ${socket.username} connected to socket: ${socket.id}`);

    // Set user online in activity tracking
    await activityTrackingService.setUserOnline(socket.userId, socket.id, {
      userAgent: socket.handshake.headers['user-agent'],
      ip: socket.handshake.address,
      platform: 'socket'
    });

    // Add user to connected users
    connectedUsers.set(socket.userId, {
      socketId: socket.id,
      username: socket.username,
      lastSeen: new Date(),
      status: 'online'
    });

    // Update user online status in database
    User.findByIdAndUpdate(
      socket.userId,
      {
        isOnline: true,
        lastActive: new Date()
      },
      { new: true }
    ).catch(err => logger.error('Error updating user online status:', err));

    // Join user to their personal room
    socket.join(`user:${socket.userId}`);

    // Notify friends about online status
    socket.broadcast.emit('user:online', {
      userId: socket.userId,
      username: socket.username,
      timestamp: new Date()
    });

    // Setup message status event handlers
    setupMessageStatusHandlers(socket);

    // Setup activity event handlers
    setupActivityHandlers(socket);

    // Handle disconnection
    socket.on('disconnect', async () => {
      logger.info(`User ${socket.username} disconnected from socket: ${socket.id}`);

      // Set user offline in activity tracking
      await activityTrackingService.setUserOffline(socket.userId, {
        disconnectedAt: new Date(),
        reason: 'disconnect'
      });

      // Remove from connected users
      connectedUsers.delete(socket.userId);

      // Update user offline status in database
      User.findByIdAndUpdate(
        socket.userId,
        {
          isOnline: false,
          lastActive: new Date()
        },
        { new: true }
      ).catch(err => logger.error('Error updating user offline status:', err));

      // Notify friends about offline status
      socket.broadcast.emit('user:offline', {
        userId: socket.userId,
        username: socket.username,
        timestamp: new Date()
      });
    });
  });

  // Message Status Event Handlers
  function setupMessageStatusHandlers(socket) {
    // Mark message as delivered
    socket.on('messageDelivered', async (data) => {
      try {
        const { messageId, deliveredAt } = data;
        const userId = socket.userId;

        if (!messageId) {
          socket.emit('error', { message: 'Message ID is required' });
          return;
        }

        // Update message status
        const Message = require('../models/Message');
        const message = await Message.findById(messageId);

        if (message && message.recipient.toString() === userId) {
          await message.markAsDelivered({ socketId: socket.id, timestamp: deliveredAt });

          // Notify sender
          emitToUser(message.sender.toString(), 'messageStatusUpdate', {
            messageId,
            status: 'delivered',
            deliveredAt: message.deliveredAt,
            recipientId: userId
          });

          logger.debug('Message delivered via socket', {
            messageId,
            sender: message.sender,
            recipient: userId
          });
        }
      } catch (error) {
        logger.error('Error handling message delivered event:', error);
        socket.emit('error', { message: 'Failed to mark message as delivered' });
      }
    });

    // Mark message as read
    socket.on('messageRead', async (data) => {
      try {
        const { messageId, readAt, deviceInfo } = data;
        const userId = socket.userId;

        if (!messageId) {
          socket.emit('error', { message: 'Message ID is required' });
          return;
        }

        // Update message status
        const Message = require('../models/Message');
        const message = await Message.findById(messageId);

        if (message && message.recipient.toString() === userId) {
          await message.markAsRead(userId, deviceInfo || `socket:${socket.id}`);

          // Also update in message status service
          const messageStatusService = require('./messageStatusService');
          await messageStatusService.markAsRead(messageId, userId, readAt);

          // Notify sender
          emitToUser(message.sender.toString(), 'messageStatusUpdate', {
            messageId,
            status: 'read',
            readAt: message.readAt,
            readBy: userId,
            deviceInfo
          });

          logger.debug('Message read via socket', {
            messageId,
            sender: message.sender,
            recipient: userId
          });
        }
      } catch (error) {
        logger.error('Error handling message read event:', error);
        socket.emit('error', { message: 'Failed to mark message as read' });
      }
    });

    // Bulk mark messages as read
    socket.on('markMultipleRead', async (data) => {
      try {
        const { messageIds, chatId, deviceInfo } = data;
        const userId = socket.userId;

        if (!messageIds || !Array.isArray(messageIds)) {
          socket.emit('error', { message: 'Message IDs array is required' });
          return;
        }

        const Message = require('../models/Message');
        const messageStatusService = require('./messageStatusService');
        
        const results = [];
        const senderNotifications = new Map();

        // Process each message
        for (const messageId of messageIds) {
          try {
            const message = await Message.findById(messageId);
            
            if (message && message.recipient.toString() === userId) {
              await message.markAsRead(userId, deviceInfo || `socket:${socket.id}`);
              results.push(messageId);

              // Group notifications by sender
              const senderId = message.sender.toString();
              if (!senderNotifications.has(senderId)) {
                senderNotifications.set(senderId, []);
              }
              senderNotifications.get(senderId).push({
                messageId,
                status: 'read',
                readAt: message.readAt,
                readBy: userId
              });
            }
          } catch (error) {
            logger.error(`Error processing message ${messageId}:`, error);
          }
        }

        // Update in service
        await messageStatusService.markMultipleAsRead(messageIds, userId, chatId);

        // Send notifications to senders
        for (const [senderId, updates] of senderNotifications) {
          emitToUser(senderId, 'multipleMessagesRead', {
            updates,
            readBy: userId,
            chatId,
            count: updates.length
          });
        }

        // Confirm to sender
        socket.emit('multipleReadConfirm', {
          successful: results,
          count: results.length,
          chatId
        });

        logger.debug('Multiple messages marked as read via socket', {
          count: results.length,
          userId,
          chatId
        });

      } catch (error) {
        logger.error('Error handling multiple read event:', error);
        socket.emit('error', { message: 'Failed to mark messages as read' });
      }
    });

    // Request message status
    socket.on('getMessageStatus', async (data) => {
      try {
        const { messageId } = data;
        const userId = socket.userId;

        if (!messageId) {
          socket.emit('error', { message: 'Message ID is required' });
          return;
        }

        const Message = require('../models/Message');
        const message = await Message.findById(messageId);

        if (!message || !message.canUserView(userId)) {
          socket.emit('error', { message: 'Message not found or access denied' });
          return;
        }

        const statusInfo = message.getStatusInfo();
        
        socket.emit('messageStatusResponse', {
          messageId,
          ...statusInfo
        });

      } catch (error) {
        logger.error('Error getting message status via socket:', error);
        socket.emit('error', { message: 'Failed to get message status' });
      }
    });

    // Handle typing with message context
    socket.on('typingInChat', (data) => {
      try {
        const { chatId, conversationId, isTyping } = data;
        const userId = socket.userId;

        if (chatId || conversationId) {
          const targetId = chatId || conversationId;
          
          // Emit to other users in the chat/conversation
          emitToChat(targetId, 'userTyping', {
            userId,
            isTyping,
            chatId: targetId,
            timestamp: Date.now()
          }, [userId]); // Exclude sender
        }
      } catch (error) {
        logger.error('Error handling typing event:', error);
      }
    });
  }

  // Activity Event Handlers  
  function setupActivityHandlers(socket) {
    // Update user activity when they interact
    socket.on('updateActivity', async (data) => {
      try {
        const userId = socket.userId;
        const { customStatus, emoji } = data;

        await activityTrackingService.updateUserActivity(userId, {
          customStatus,
          emoji,
          lastSeen: Date.now(),
          activeConnection: socket.id
        });

        logger.debug('User activity updated via socket', { userId, customStatus });
      } catch (error) {
        logger.error('Error updating user activity:', error);
      }
    });

    // Get friend activity
    socket.on('getFriendsActivity', async () => {
      try {
        const userId = socket.userId;
        const friendsActivity = await activityTrackingService.getFriendsActivity(userId);

        socket.emit('friendsActivityUpdate', friendsActivity);
      } catch (error) {
        logger.error('Error getting friends activity:', error);
        socket.emit('error', { message: 'Failed to get friends activity' });
      }
    });

    // Handle heartbeat
    socket.on('heartbeat', async () => {
      try {
        const userId = socket.userId;
        await activityTrackingService.updateHeartbeat(userId, socket.id);
      } catch (error) {
        logger.error('Error handling heartbeat:', error);
      }
    });
  }

    // Handle custom status updates
    socket.on('status:set', async (data) => {
      try {
        const { message, emoji } = data;
        await activityTrackingService.setCustomStatus(socket.userId, message, emoji);
        
        // Notify friends about status change
        socket.broadcast.emit('user:status:changed', {
          userId: socket.userId,
          customStatus: { message, emoji, timestamp: new Date() }
        });
        
        socket.emit('status:set', { success: true });
      } catch (error) {
        logger.error('Set status failed:', error);
        socket.emit('status:set', { success: false, error: error.message });
      }
    });

    // Handle status clear
    socket.on('status:clear', async () => {
      try {
        await activityTrackingService.clearCustomStatus(socket.userId);
        
        // Notify friends about status change
        socket.broadcast.emit('user:status:changed', {
          userId: socket.userId,
          customStatus: null
        });
        
        socket.emit('status:cleared', { success: true });
      } catch (error) {
        logger.error('Clear status failed:', error);
        socket.emit('status:cleared', { success: false, error: error.message });
      }
    });

    // Handle get online friends
    socket.on('friends:getOnline', async (data) => {
      try {
        const { friendIds } = data;
        const onlineFriends = await activityTrackingService.getOnlineFriends(socket.userId, friendIds);
        
        socket.emit('friends:online', { friends: onlineFriends });
      } catch (error) {
        logger.error('Get online friends failed:', error);
        socket.emit('friends:online', { friends: [], error: error.message });
      }
    });

    // Handle joining chat rooms
    socket.on('chat:join', data => {
      const { conversationId } = data;
      socket.join(`chat:${conversationId}`);
      logger.info(`User ${socket.username} joined chat: ${conversationId}`);
    });

    // Handle leaving chat rooms
    socket.on('chat:leave', data => {
      const { conversationId } = data;
      socket.leave(`chat:${conversationId}`);
      logger.info(`User ${socket.username} left chat: ${conversationId}`);
    });

    // Handle sending messages
    socket.on('message:send', async data => {
      try {
        const { recipientId, content, messageType = 'text', conversationId } = data;

        // Validate message
        if (!content || content.trim().length === 0) {
          socket.emit('message:error', { error: 'Message content is required' });
          return;
        }

        if (content.length > 2000) {
          socket.emit('message:error', { error: 'Message too long' });
          return;
        }

        // Check if recipient exists and is not blocked
        const recipient = await User.findById(recipientId);
        if (!recipient) {
          socket.emit('message:error', { error: 'Recipient not found' });
          return;
        }

        // Check if sender is blocked by recipient
        if (recipient.blockedUsers.includes(socket.userId)) {
          socket.emit('message:error', { error: 'Unable to send message' });
          return;
        }

        // Create message object
        const message = {
          id: new Date().getTime().toString(), // Temporary ID
          senderId: socket.userId,
          recipientId,
          content: content.trim(),
          messageType,
          timestamp: new Date(),
          isRead: false,
          conversationId: conversationId || `${[socket.userId, recipientId].sort().join(':')}`
        };

        // Emit to sender (confirmation)
        socket.emit('message:sent', message);

        // Emit to recipient if online
        const recipientSocketData = connectedUsers.get(recipientId);
        if (recipientSocketData) {
          io.to(`user:${recipientId}`).emit('message:receive', message);
        }

        // Emit to conversation room
        socket.to(`chat:${message.conversationId}`).emit('message:new', message);

        logger.info(`Message sent from ${socket.username} to ${recipientId}`);

        // TODO: Save message to database
        // TODO: Send push notification if recipient is offline
      } catch (error) {
        logger.error('Message send error:', error.message);
        socket.emit('message:error', { error: 'Failed to send message' });
      }
    });

    // Handle message read status
    socket.on('message:read', data => {
      const { messageId, senderId } = data;

      // Notify sender that message was read
      io.to(`user:${senderId}`).emit('message:read', {
        messageId,
        readBy: socket.userId,
        readAt: new Date()
      });

      logger.info(`Message ${messageId} marked as read by ${socket.username}`);
    });

    // Handle typing indicators
    socket.on('typing:start', data => {
      const { recipientId, conversationId } = data;

      if (conversationId) {
        socket.to(`chat:${conversationId}`).emit('typing:start', {
          userId: socket.userId,
          username: socket.username
        });
      } else {
        io.to(`user:${recipientId}`).emit('typing:start', {
          userId: socket.userId,
          username: socket.username
        });
      }
    });

    socket.on('typing:stop', data => {
      const { recipientId, conversationId } = data;

      if (conversationId) {
        socket.to(`chat:${conversationId}`).emit('typing:stop', {
          userId: socket.userId
        });
      } else {
        io.to(`user:${recipientId}`).emit('typing:stop', {
          userId: socket.userId
        });
      }
    });

    // Handle post interactions
    socket.on('post:like', data => {
      const { postId, authorId } = data;

      // Notify post author
      io.to(`user:${authorId}`).emit('notification:new', {
        type: 'post_like',
        fromUser: {
          id: socket.userId,
          username: socket.username
        },
        postId,
        timestamp: new Date()
      });

      // Broadcast to followers/friends
      socket.broadcast.emit('post:liked', {
        postId,
        userId: socket.userId,
        username: socket.username
      });
    });

    socket.on('post:comment', data => {
      const { postId, authorId, comment } = data;

      // Notify post author
      io.to(`user:${authorId}`).emit('notification:new', {
        type: 'post_comment',
        fromUser: {
          id: socket.userId,
          username: socket.username
        },
        postId,
        comment,
        timestamp: new Date()
      });
    });

    // Handle friend requests
    socket.on('friend:request', data => {
      const { recipientId } = data;

      // Notify recipient
      io.to(`user:${recipientId}`).emit('notification:new', {
        type: 'friend_request',
        fromUser: {
          id: socket.userId,
          username: socket.username
        },
        timestamp: new Date()
      });
    });

    socket.on('friend:accept', data => {
      const { userId } = data;

      // Notify the user who sent the request
      io.to(`user:${userId}`).emit('notification:new', {
        type: 'friend_accept',
        fromUser: {
          id: socket.userId,
          username: socket.username
        },
        timestamp: new Date()
      });
    });

    // Handle user status updates
    socket.on('status:update', data => {
      const { status } = data; // 'online', 'away', 'busy', 'invisible'

      if (['online', 'away', 'busy', 'invisible'].includes(status)) {
        const userData = connectedUsers.get(socket.userId);
        if (userData) {
          userData.status = status;
          connectedUsers.set(socket.userId, userData);
        }

        // Broadcast status to friends
        socket.broadcast.emit('user:status', {
          userId: socket.userId,
          status,
          timestamp: new Date()
        });
      }
    });

    // Handle call events (for future video/voice calling feature)
    socket.on('call:initiate', data => {
      const { recipientId, callType } = data; // callType: 'voice' or 'video'

      io.to(`user:${recipientId}`).emit('call:incoming', {
        callerId: socket.userId,
        callerUsername: socket.username,
        callType,
        timestamp: new Date()
      });
    });

    socket.on('call:accept', data => {
      const { callerId } = data;

      io.to(`user:${callerId}`).emit('call:accepted', {
        recipientId: socket.userId,
        timestamp: new Date()
      });
    });

    socket.on('call:reject', data => {
      const { callerId } = data;

      io.to(`user:${callerId}`).emit('call:rejected', {
        recipientId: socket.userId,
        timestamp: new Date()
      });
    });

    socket.on('call:end', data => {
      const { recipientId } = data;

      io.to(`user:${recipientId}`).emit('call:ended', {
        endedBy: socket.userId,
        timestamp: new Date()
      });
    });

    // Handle disconnect
    socket.on('disconnect', async reason => {
      logger.info(`User ${socket.username} disconnected: ${reason}`);

      // Set user offline in activity tracking
      await activityTrackingService.handleSocketDisconnect(socket.id);

      // Remove from connected users
      connectedUsers.delete(socket.userId);

      // Update user online status in database
      User.findByIdAndUpdate(
        socket.userId,
        {
          isOnline: false,
          lastActive: new Date()
        },
        { new: true }
      ).catch(err => logger.error('Error updating user offline status:', err));

      // Notify friends about offline status
      socket.broadcast.emit('user:offline', {
        userId: socket.userId,
        username: socket.username,
        timestamp: new Date()
      });
    });

    // Handle errors
    socket.on('error', error => {
      logger.error(`Socket error for user ${socket.username}:`, error);
    });
  });

  // Helper function to get online users count
  function getOnlineUsersCount() {
    return connectedUsers.size;
  }

  // Helper function to check if user is online  
  function isUserOnline(userId) {
    return connectedUsers.has(userId);
  }

  // Helper function to get online users
  function getOnlineUsers() {
    return Array.from(connectedUsers.entries()).map(([userId, data]) => ({
      userId,
      ...data
    }));
  }

  // Helper function to send notification to user
  function sendNotificationToUser(userId, notification) {
    io.to(`user:${userId}`).emit('notification:new', notification);
  }

  // Helper function to emit to specific user
  function emitToUser(userId, event, data) {
    io.to(`user:${userId}`).emit(event, data);
  }

  // Helper function to emit to chat
  function emitToChat(chatId, event, data, excludeUsers = []) {
    const socketData = { ...data, chatId };
    if (excludeUsers.length > 0) {
      // Emit to all users in chat except excluded ones
      Object.values(io.sockets.sockets).forEach(socket => {
        if (socket.userId && !excludeUsers.includes(socket.userId)) {
          socket.emit(event, socketData);
        }
      });
    } else {
      io.to(`chat:${chatId}`).emit(event, socketData);
    }
  }

  // Helper function to broadcast to all users
  function broadcastToAll(event, data) {
    io.emit(event, data);
  }

  // Export helper functions
  io.getOnlineUsersCount = getOnlineUsersCount;
  io.isUserOnline = isUserOnline;
  io.getOnlineUsers = getOnlineUsers;
  io.sendNotificationToUser = sendNotificationToUser;
  io.emitToUser = emitToUser;
  io.emitToChat = emitToChat;
  io.broadcastToAll = broadcastToAll;

  logger.info('Socket.IO service initialized');
};

module.exports = initializeSocket;
