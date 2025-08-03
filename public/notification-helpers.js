const Notification = require('../models/Notification');

/**
 * Helper functions để tạo notifications tự động
 */

// Tạo notification khi có tin nhắn mới
async function createMessageNotification(senderId, recipientId, messageContent) {
  try {
    const notification = new Notification({
      recipient: recipientId,
      sender: senderId,
      type: 'post_mention', // Sử dụng post_mention cho message vì không có enum message
      message: `Bạn có tin nhắn mới: "${messageContent.substring(0, 50)}${messageContent.length > 50 ? '...' : ''}"`,
      data: {
        messageId: messageContent.id || null,
        conversationId: `${senderId}_${recipientId}`,
        preview: messageContent.substring(0, 100)
      }
    });
    
    await notification.save();
    console.log('📧 Created message notification:', notification._id);
    return notification;
  } catch (error) {
    console.error('❌ Error creating message notification:', error);
    return null;
  }
}

// Tạo notification khi có lời mời kết bạn
async function createFriendRequestNotification(senderId, recipientId) {
  try {
    const notification = new Notification({
      recipient: recipientId,
      sender: senderId,
      type: 'friend_request',
      message: 'Bạn có lời mời kết bạn mới',
      data: {
        requestId: `${senderId}_${recipientId}`,
        status: 'pending'
      }
    });
    
    await notification.save();
    console.log('👥 Created friend request notification:', notification._id);
    return notification;
  } catch (error) {
    console.error('❌ Error creating friend request notification:', error);
    return null;
  }
}

// Tạo notification khi chấp nhận kết bạn
async function createFriendAcceptNotification(senderId, recipientId) {
  try {
    const notification = new Notification({
      recipient: recipientId,
      sender: senderId,
      type: 'friend_accept',
      message: 'Lời mời kết bạn của bạn đã được chấp nhận',
      data: {
        requestId: `${recipientId}_${senderId}`,
        status: 'accepted'
      }
    });
    
    await notification.save();
    console.log('✅ Created friend accept notification:', notification._id);
    return notification;
  } catch (error) {
    console.error('❌ Error creating friend accept notification:', error);
    return null;
  }
}

// Tạo notification khi có follow mới
async function createFollowNotification(senderId, recipientId) {
  try {
    const notification = new Notification({
      recipient: recipientId,
      sender: senderId,
      type: 'follow',
      message: 'Bạn có người theo dõi mới',
      data: {
        followId: `${senderId}_${recipientId}`,
        timestamp: new Date()
      }
    });
    
    await notification.save();
    console.log('👤 Created follow notification:', notification._id);
    return notification;
  } catch (error) {
    console.error('❌ Error creating follow notification:', error);
    return null;
  }
}

// Tạo notification khi có like mới
async function createLikeNotification(senderId, recipientId, postId) {
  try {
    const notification = new Notification({
      recipient: recipientId,
      sender: senderId,
      type: 'like',
      message: 'Bài viết của bạn đã được thích',
      relatedPost: postId,
      data: {
        postId: postId,
        likeId: `${senderId}_${postId}`,
        timestamp: new Date()
      }
    });
    
    await notification.save();
    console.log('❤️ Created like notification:', notification._id);
    return notification;
  } catch (error) {
    console.error('❌ Error creating like notification:', error);
    return null;
  }
}

// Tạo notification khi có comment mới
async function createCommentNotification(senderId, recipientId, postId, commentContent) {
  try {
    const notification = new Notification({
      recipient: recipientId,
      sender: senderId,
      type: 'comment',
      message: `Bài viết của bạn có bình luận mới: "${commentContent.substring(0, 50)}${commentContent.length > 50 ? '...' : ''}"`,
      relatedPost: postId,
      data: {
        postId: postId,
        commentId: `${senderId}_${postId}_${Date.now()}`,
        commentPreview: commentContent.substring(0, 100),
        timestamp: new Date()
      }
    });
    
    await notification.save();
    console.log('💬 Created comment notification:', notification._id);
    return notification;
  } catch (error) {
    console.error('❌ Error creating comment notification:', error);
    return null;
  }
}

// Tạo notification cho mention trong post
async function createMentionNotification(senderId, recipientId, postId, content) {
  try {
    const notification = new Notification({
      recipient: recipientId,
      sender: senderId,
      type: 'post_mention',
      message: `Bạn được nhắc đến trong một bài viết: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
      relatedPost: postId,
      data: {
        postId: postId,
        mentionId: `${senderId}_${postId}_${recipientId}`,
        contentPreview: content.substring(0, 100),
        timestamp: new Date()
      }
    });
    
    await notification.save();
    console.log('🏷️ Created mention notification:', notification._id);
    return notification;
  } catch (error) {
    console.error('❌ Error creating mention notification:', error);
    return null;
  }
}

// Hàm tiện ích để tạo notification chung
async function createNotification(type, senderId, recipientId, message, data = {}) {
  try {
    const notification = new Notification({
      recipient: recipientId,
      sender: senderId,
      type: type,
      message: message,
      data: data
    });
    
    await notification.save();
    console.log(`🔔 Created ${type} notification:`, notification._id);
    return notification;
  } catch (error) {
    console.error(`❌ Error creating ${type} notification:`, error);
    return null;
  }
}

// Export tất cả functions
module.exports = {
  createMessageNotification,
  createFriendRequestNotification,
  createFriendAcceptNotification,
  createFollowNotification,
  createLikeNotification,
  createCommentNotification,
  createMentionNotification,
  createNotification
};
