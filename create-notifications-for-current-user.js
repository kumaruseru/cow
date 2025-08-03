const mongoose = require('mongoose');
const Notification = require('./models/Notification');
const SimpleUser = require('./models/SimpleUser');

// Kết nối MongoDB
mongoose.connect('mongodb://localhost:27017/cow_social_network').then(async () => {
  console.log('📦 MongoDB connected for notification creation');
  
  try {
    // Tìm user john@example.com 
    const currentUser = await SimpleUser.findOne({ email: 'john@example.com' });
    if (!currentUser) {
      console.log('❌ User john@example.com not found');
      return;
    }
    
    console.log('👤 Found user:', currentUser.email, currentUser._id);
    
    // Tìm user khác để làm sender (john hoặc jane)
    const otherUsers = await SimpleUser.find({ email: { $ne: 'nghiaht281003@gmail.com' } }).limit(2);
    console.log('👥 Other users:', otherUsers.map(u => u.email));
    
    if (otherUsers.length === 0) {
      console.log('❌ No other users found to create notifications');
      return;
    }
    
    const senderUser = otherUsers[0];
    
    // Xóa notifications cũ của user hiện tại
    await Notification.deleteMany({ recipient: currentUser._id });
    console.log('🗑️ Cleared existing notifications for current user');
    
    // Tạo notifications mới cho user hiện tại
    const newNotifications = [
      {
        recipient: currentUser._id,
        sender: senderUser._id,
        type: 'friend_request',
        message: `${senderUser.email} đã gửi cho bạn lời mời kết bạn`,
        data: { requestId: `${senderUser._id}_${currentUser._id}` },
        isRead: false,
        createdAt: new Date(Date.now() - 5 * 60 * 1000)
      },
      {
        recipient: currentUser._id,
        sender: senderUser._id,
        type: 'like',
        message: `${senderUser.email} đã thích bài viết của bạn`,
        data: { postId: new mongoose.Types.ObjectId() },
        isRead: false,
        createdAt: new Date(Date.now() - 30 * 60 * 1000)
      },
      {
        recipient: currentUser._id,
        sender: senderUser._id,
        type: 'comment',
        message: `${senderUser.email} đã bình luận về bài viết của bạn`,
        data: { postId: new mongoose.Types.ObjectId(), commentId: new mongoose.Types.ObjectId() },
        isRead: false,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
      },
      {
        recipient: currentUser._id,
        sender: senderUser._id,
        type: 'follow',
        message: `${senderUser.email} đã bắt đầu theo dõi bạn`,
        data: { followId: `${senderUser._id}_${currentUser._id}` },
        isRead: true,
        readAt: new Date(Date.now() - 30 * 60 * 1000),
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    ];
    
    // Lưu notifications
    const created = await Notification.insertMany(newNotifications);
    console.log(`✅ Created ${created.length} notifications for ${currentUser.email}`);
    
    // Kiểm tra kết quả
    const userNotifications = await Notification.find({ recipient: currentUser._id })
      .populate('sender', 'email')
      .sort({ createdAt: -1 });
    
    console.log('\n📋 Notifications for current user:');
    userNotifications.forEach(notif => {
      const status = notif.isRead ? '✅ Read' : '❌ Unread';
      const sender = notif.sender ? notif.sender.email : 'Unknown';
      console.log(`  ${status} ${notif.type}: ${notif.message} (from ${sender})`);
    });
    
    const unreadCount = await Notification.countDocuments({ 
      recipient: currentUser._id, 
      isRead: false 
    });
    console.log(`\n📊 Unread notifications: ${unreadCount}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
});
