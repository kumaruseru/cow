const mongoose = require('mongoose');
const Friend = require('./models/Friend');
const SimpleUser = require('./models/SimpleUser');

// Kết nối MongoDB
mongoose.connect('mongodb://localhost:27017/cow_social_network').then(async () => {
  console.log('📦 MongoDB connected for creating friend relationships');
  
  try {
    // Lấy tất cả users
    const users = await SimpleUser.find().select('_id email firstName lastName');
    console.log('👥 Found users:', users.map(u => ({ id: u._id, email: u.email })));
    
    if (users.length < 2) {
      console.log('❌ Need at least 2 users to create friendships');
      return;
    }
    
    // Xóa tất cả friend relationships cũ
    await Friend.deleteMany({});
    console.log('🗑️ Cleared all existing friendships');
    
    // Tạo friendships mẫu
    const friendships = [];
    
    // Tạo kết bạn giữa user đầu tiên và thứ hai
    if (users.length >= 2) {
      friendships.push({
        requester: users[0]._id,
        recipient: users[1]._id,
        status: 'accepted',
        requestedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 ngày trước
        acceptedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)   // 6 ngày trước
      });
    }
    
    // Nếu có user thứ 3, tạo pending request
    if (users.length >= 3) {
      friendships.push({
        requester: users[2]._id,
        recipient: users[0]._id,
        status: 'pending',
        requestedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 ngày trước
      });
    }
    
    // Nếu có user thứ 4, tạo thêm accepted friendship
    if (users.length >= 4) {
      friendships.push({
        requester: users[1]._id,
        recipient: users[3]._id,
        status: 'accepted',
        requestedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 ngày trước
        acceptedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)   // 4 ngày trước
      });
    }
    
    // Lưu friendships
    if (friendships.length > 0) {
      const createdFriendships = await Friend.insertMany(friendships);
      console.log(`✅ Created ${createdFriendships.length} friendships`);
    }
    
    // Hiển thị thống kê
    const totalFriendships = await Friend.countDocuments();
    const acceptedFriendships = await Friend.countDocuments({ status: 'accepted' });
    const pendingRequests = await Friend.countDocuments({ status: 'pending' });
    
    console.log(`📊 Total friendships: ${totalFriendships}`);
    console.log(`📊 Accepted friendships: ${acceptedFriendships}`);
    console.log(`📊 Pending requests: ${pendingRequests}`);
    
    // Hiển thị chi tiết friendships
    const allFriendships = await Friend.find()
      .populate('requester', 'email firstName lastName')
      .populate('recipient', 'email firstName lastName')
      .sort({ createdAt: -1 });
    
    console.log('\n👥 Friend relationships:');
    allFriendships.forEach((friendship, index) => {
      const requesterName = friendship.requester ? 
        (friendship.requester.firstName || friendship.requester.email) : 'Unknown';
      const recipientName = friendship.recipient ? 
        (friendship.recipient.firstName || friendship.recipient.email) : 'Unknown';
      
      console.log(`${index + 1}. ${requesterName} → ${recipientName} (${friendship.status})`);
    });
    
    // Test getFriends method cho user đầu tiên
    if (users.length > 0) {
      console.log(`\n🔍 Testing getFriends for ${users[0].email}:`);
      const friends = await Friend.getFriends(users[0]._id);
      friends.forEach(friendship => {
        const friend = friendship.requester._id.toString() === users[0]._id.toString() 
          ? friendship.recipient 
          : friendship.requester;
        const friendName = friend.firstName || friend.email;
        console.log(`  - Friend: ${friendName}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error creating friend relationships:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
});
