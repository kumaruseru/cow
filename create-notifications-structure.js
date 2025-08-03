const { MongoClient, ObjectId } = require('mongodb');

async function createNotificationsStructure() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('cow_social_network');
    
    console.log('=== Creating notifications collection ===');
    
    // Tạo notifications collection nếu chưa có
    const collections = await db.listCollections().toArray();
    const notificationsExists = collections.some(col => col.name === 'notifications');
    
    if (!notificationsExists) {
      await db.createCollection('notifications');
      console.log('✅ Created notifications collection');
    } else {
      console.log('📋 Notifications collection already exists');
    }
    
    // Lấy một số users để tạo sample notifications
    const users = await db.collection('users').find({}).limit(3).toArray();
    
    if (users.length >= 2) {
      const user1 = users[0];
      const user2 = users[1];
      
      // Tạo sample notifications
      const sampleNotifications = [
        {
          recipient: new ObjectId(user1._id),
          sender: new ObjectId(user2._id),
          type: 'friend_request',
          title: 'Lời mời kết bạn',
          message: `${user2.firstName} ${user2.lastName} đã gửi lời mời kết bạn`,
          isRead: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          data: {
            userId: user2._id,
            action: 'friend_request'
          }
        },
        {
          recipient: new ObjectId(user2._id),
          sender: new ObjectId(user1._id),
          type: 'message',
          title: 'Tin nhắn mới',
          message: `${user1.firstName} ${user1.lastName} đã gửi tin nhắn cho bạn`,
          isRead: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          data: {
            messageId: new ObjectId(),
            conversationId: new ObjectId()
          }
        },
        {
          recipient: new ObjectId(user1._id),
          sender: new ObjectId(user2._id),
          type: 'like',
          title: 'Lượt thích mới',
          message: `${user2.firstName} ${user2.lastName} đã thích bài viết của bạn`,
          isRead: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          data: {
            postId: new ObjectId(),
            action: 'like'
          }
        }
      ];
      
      // Xóa notifications cũ và tạo mới
      await db.collection('notifications').deleteMany({});
      const result = await db.collection('notifications').insertMany(sampleNotifications);
      console.log(`✅ Created ${result.insertedCount} sample notifications`);
      
      // Tạo indexes cho notifications
      await db.collection('notifications').createIndex({ recipient: 1, createdAt: -1 });
      await db.collection('notifications').createIndex({ sender: 1 });
      await db.collection('notifications').createIndex({ isRead: 1 });
      console.log('✅ Created notifications indexes');
      
      console.log('\n=== Sample notifications ===');
      const notifications = await db.collection('notifications').find({}).limit(2).toArray();
        
      notifications.forEach((notif, index) => {
        console.log(`Notification ${index + 1}:`, {
          _id: notif._id,
          type: notif.type,
          title: notif.title,
          message: notif.message,
          isRead: notif.isRead,
          recipient: notif.recipient,
          sender: notif.sender
        });
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

createNotificationsStructure();
