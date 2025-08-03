const mongoose = require('mongoose');

// Kết nối MongoDB
mongoose.connect('mongodb://localhost:27017/cow_social_network').then(async () => {
  console.log('📦 MongoDB connected for index cleanup');
  
  try {
    // Liệt kê tất cả indexes
    const indexes = await mongoose.connection.db.collection('users').indexes();
    console.log('📋 Current indexes:', indexes.map(idx => ({ name: idx.name, key: idx.key })));
    
    // Xóa index username_1 nếu tồn tại
    try {
      await mongoose.connection.db.collection('users').dropIndex('username_1');
      console.log('✅ Dropped username_1 index');
    } catch (error) {
      console.log('⚠️ Username index may not exist:', error.message);
    }
    
    // Xóa trường username khỏi tất cả users
    const result = await mongoose.connection.db.collection('users').updateMany(
      {}, // Tất cả documents
      { $unset: { username: '' } } // Xóa trường username
    );
    
    console.log(`✅ Removed username field from ${result.modifiedCount} users`);
    
    // Kiểm tra lại data sau khi xóa
    const users = await mongoose.connection.db.collection('users').find().toArray();
    console.log('\n👥 Users after cleanup:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} - username: ${user.username || 'REMOVED'} - hasPasswordHash: ${!!user.passwordHash}`);
    });
    
    // Liệt kê indexes sau cleanup
    const finalIndexes = await mongoose.connection.db.collection('users').indexes();
    console.log('\n📋 Final indexes:', finalIndexes.map(idx => ({ name: idx.name, key: idx.key })));
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
});
