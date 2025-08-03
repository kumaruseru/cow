const mongoose = require('mongoose');
const Friend = require('./models/Friend');
const SimpleUser = require('./models/SimpleUser');

// Kết nối MongoDB
mongoose.connect('mongodb://localhost:27017/cow_social_network').then(async () => {
  console.log('📦 MongoDB connected for creating more test data');
  
  try {
    // Lấy tất cả users
    const users = await SimpleUser.find().select('_id email firstName lastName');
    console.log('👥 Found users:', users.map(u => ({ id: u._id, email: u.email })));
    
    if (users.length < 2) {
      console.log('❌ Need at least 2 users');
      return;
    }
    
    // Tạo thêm một số users test nếu cần
    const testUsers = [];
    if (users.length === 2) {
      // Tạo thêm 2 users test
      const newUsers = [
        {
          email: 'alice@example.com',
          firstName: 'Alice',
          lastName: 'Smith',
          passwordHash: '$2b$12$dummy.hash.for.testing.only'
        },
        {
          email: 'bob@example.com', 
          firstName: 'Bob',
          lastName: 'Johnson',
          passwordHash: '$2b$12$dummy.hash.for.testing.only'
        }
      ];
      
      const createdUsers = await SimpleUser.insertMany(newUsers);
      testUsers.push(...createdUsers);
      console.log(`✅ Created ${createdUsers.length} additional test users`);
    }
    
    const allUsers = [...users, ...testUsers];
    
    // Tạo thêm các friend relationships
    const additionalFriendships = [];
    
    if (allUsers.length >= 3) {
      // Alice gửi friend request cho John (pending)
      additionalFriendships.push({
        requester: allUsers[2]._id, // Alice
        recipient: allUsers[0]._id, // John
        status: 'pending',
        requestedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 ngày trước
      });
    }
    
    if (allUsers.length >= 4) {
      // Bob gửi friend request cho Jane (pending)
      additionalFriendships.push({
        requester: allUsers[3]._id, // Bob
        recipient: allUsers[1]._id, // Jane  
        status: 'pending',
        requestedAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 giờ trước
      });
      
      // John gửi friend request cho Bob (pending)
      additionalFriendships.push({
        requester: allUsers[0]._id, // John
        recipient: allUsers[3]._id, // Bob
        status: 'pending',
        requestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 giờ trước
      });
    }
    
    // Lưu additional friendships
    if (additionalFriendships.length > 0) {
      const createdFriendships = await Friend.insertMany(additionalFriendships);
      console.log(`✅ Created ${createdFriendships.length} additional friendships`);
    }
    
    // Hiển thị thống kê cuối cùng
    const totalUsers = await SimpleUser.countDocuments();
    const totalFriendships = await Friend.countDocuments();
    const acceptedFriendships = await Friend.countDocuments({ status: 'accepted' });
    const pendingRequests = await Friend.countDocuments({ status: 'pending' });
    
    console.log(`\n📊 Final statistics:`);
    console.log(`👥 Total users: ${totalUsers}`);
    console.log(`🤝 Total friendships: ${totalFriendships}`);
    console.log(`✅ Accepted friendships: ${acceptedFriendships}`);
    console.log(`⏳ Pending requests: ${pendingRequests}`);
    
    // Hiển thị tất cả friendships
    const allFriendships = await Friend.find()
      .populate('requester', 'email firstName lastName')
      .populate('recipient', 'email firstName lastName')
      .sort({ createdAt: -1 });
    
    console.log('\n👥 All friend relationships:');
    allFriendships.forEach((friendship, index) => {
      const requesterName = friendship.requester ? 
        (friendship.requester.firstName || friendship.requester.email) : 'Unknown';
      const recipientName = friendship.recipient ? 
        (friendship.recipient.firstName || friendship.recipient.email) : 'Unknown';
      
      const statusIcon = friendship.status === 'accepted' ? '✅' : 
                        friendship.status === 'pending' ? '⏳' : '❌';
      
      console.log(`${index + 1}. ${statusIcon} ${requesterName} → ${recipientName} (${friendship.status})`);
    });
    
  } catch (error) {
    console.error('❌ Error creating test data:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
});
