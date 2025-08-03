const mongoose = require('mongoose');
const Notification = require('./models/Notification');
const SimpleUser = require('./models/SimpleUser');

// Kết nối MongoDB
mongoose.connect('mongodb://localhost:27017/cow_social_network', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('📦 MongoDB connected for notification creation');
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
});

async function createSampleNotifications() {
  try {
    console.log('🔔 Creating sample notifications...');
    
    // Lấy danh sách users
    const users = await SimpleUser.find().select('_id email name');
    console.log('👥 Found users:', users.map(u => ({id: u._id, email: u.email, name: u.name})));
    
    if (users.length < 2) {
      console.log('❌ Need at least 2 users to create notifications');
      return;
    }
    
    const user1 = users[0];
    const user2 = users[1];
    
    // Xóa tất cả notifications cũ
    await Notification.deleteMany({});
    console.log('🗑️ Cleared all existing notifications');
    
    // Tạo notifications mẫu
    const sampleNotifications = [
      {
        recipient: user1._id,
        sender: user2._id,
        type: 'friend_request',
        message: `${user2.name || user2.email} đã gửi cho bạn lời mời kết bạn`,
        data: {
          requestId: new mongoose.Types.ObjectId()
        },
        isRead: false,
        createdAt: new Date(Date.now() - 5 * 60 * 1000) // 5 phút trước
      },
      {
        recipient: user1._id,
        sender: user2._id,
        type: 'friend_accept',
        message: `${user2.name || user2.email} đã chấp nhận lời mời kết bạn của bạn`,
        data: {
          requestId: new mongoose.Types.ObjectId()
        },
        isRead: false,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 giờ trước
      },
      {
        recipient: user1._id,
        sender: user2._id,
        type: 'like',
        message: `${user2.name || user2.email} đã thích bài viết của bạn`,
        relatedPost: new mongoose.Types.ObjectId(),
        data: {
          postId: new mongoose.Types.ObjectId()
        },
        isRead: true,
        readAt: new Date(Date.now() - 30 * 60 * 1000), // Đã đọc 30 phút trước
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 ngày trước
      },
      {
        recipient: user2._id,
        sender: user1._id,
        type: 'comment',
        message: `${user1.name || user1.email} đã bình luận về bài viết của bạn`,
        relatedPost: new mongoose.Types.ObjectId(),
        relatedComment: new mongoose.Types.ObjectId(),
        data: {
          postId: new mongoose.Types.ObjectId(),
          commentId: new mongoose.Types.ObjectId()
        },
        isRead: false,
        createdAt: new Date(Date.now() - 15 * 60 * 1000) // 15 phút trước
      },
      {
        recipient: user2._id,
        sender: user1._id,
        type: 'follow',
        message: `${user1.name || user1.email} đã bắt đầu theo dõi bạn`,
        data: {
          followId: new mongoose.Types.ObjectId()
        },
        isRead: false,
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 giờ trước
      }
    ];
    
    // Lưu notifications
    const createdNotifications = await Notification.insertMany(sampleNotifications);
    console.log(`✅ Created ${createdNotifications.length} sample notifications`);
    
    // Hiển thị thống kê
    const totalNotifications = await Notification.countDocuments();
    const unreadCount = await Notification.countDocuments({ isRead: false });
    
    console.log(`📊 Total notifications: ${totalNotifications}`);
    console.log(`📊 Unread notifications: ${unreadCount}`);
    
    // Hiển thị notifications cho từng user
    for (const user of users) {
      const userNotifications = await Notification.find({ recipient: user._id })
        .populate('sender', 'name email')
        .sort({ createdAt: -1 });
      
      console.log(`\n👤 Notifications for ${user.name || user.email}:`);
      userNotifications.forEach(notif => {
        const status = notif.isRead ? '✅ Read' : '❌ Unread';
        const sender = notif.sender ? (notif.sender.name || notif.sender.email) : 'System';
        console.log(`  ${status} ${notif.type}: ${notif.message} (from ${sender})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error creating sample notifications:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Chạy script
createSampleNotifications();
