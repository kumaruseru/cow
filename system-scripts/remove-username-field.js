const mongoose = require('mongoose');

// Kết nối MongoDB
mongoose.connect('mongodb://localhost:27017/cow_social_network', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log('📦 MongoDB connected for username cleanup');
  
  try {
    // Xóa trường username khỏi tất cả users
    const result = await mongoose.connection.db.collection('users').updateMany(
      {}, // Tất cả documents
      { $unset: { username: "" } } // Xóa trường username
    );
    
    console.log(`✅ Removed username field from ${result.modifiedCount} users`);
    
    // Kiểm tra lại data sau khi xóa
    const users = await mongoose.connection.db.collection('users').find().toArray();
    console.log('\n👥 Users after cleanup:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} - username: ${user.username || 'REMOVED'} - hasPasswordHash: ${!!user.passwordHash}`);
    });
    
  } catch (error) {
    console.error('❌ Error removing username fields:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
});
