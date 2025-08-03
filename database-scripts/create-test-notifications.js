const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/cow_social_network')
  .then(() => {
    console.log('✅ Connected to MongoDB');
  }).catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

async function createTestNotifications() {
  try {
    console.log('🔔 Creating test notifications...\n');
    
    // Get users
    const users = await User.find({}).limit(3).lean();
    if (users.length < 2) {
      console.log('❌ Need at least 2 users to create test notifications');
      return;
    }
    
    console.log(`Found ${users.length} users:`);
    users.forEach((user, index) => {
      const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username;
      console.log(`${index + 1}. ${name} (${user.email})`);
    });
    
    const testNotifications = [
      {
        recipient: users[0]._id,
        sender: users[1]._id,
        type: 'like',
        message: `${users[1].firstName || users[1].username} đã thích bài viết của bạn`
      },
      {
        recipient: users[0]._id,
        sender: users[1]._id,
        type: 'comment',
        message: `${users[1].firstName || users[1].username} đã bình luận về bài viết của bạn`
      },
      {
        recipient: users[1]._id,
        sender: users[0]._id,
        type: 'friend_request',
        message: `${users[0].firstName || users[0].username} đã gửi lời mời kết bạn`
      }
    ];
    
    if (users.length >= 3) {
      testNotifications.push({
        recipient: users[2]._id,
        sender: users[0]._id,
        type: 'follow',
        message: `${users[0].firstName || users[0].username} đã bắt đầu theo dõi bạn`
      });
    }
    
    console.log('\n📝 Creating notifications...');
    const createdNotifications = await Notification.insertMany(testNotifications);
    
    console.log(`✅ Created ${createdNotifications.length} test notifications:`);
    createdNotifications.forEach((notif, index) => {
      console.log(`${index + 1}. ${notif.type}: ${notif.message}`);
    });
    
    console.log('\n🎉 Test notifications created successfully!');
    console.log('You can now test the notification system in the browser.');
    
  } catch (error) {
    console.error('❌ Error creating test notifications:', error);
  } finally {
    mongoose.connection.close();
  }
}

createTestNotifications();
