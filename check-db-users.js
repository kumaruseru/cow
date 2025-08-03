// Kiểm tra users trong database
const mongoose = require('mongoose');
const User = require('./models/User');

const checkDatabaseUsers = async () => {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/cow_social_network');
    console.log('✅ Connected to database');
    
    console.log('\n📊 Checking users in database:');
    console.log('========================================');
    
    const users = await User.find({}, 'email firstName lastName createdAt').sort({ createdAt: -1 });
    
    if (users.length === 0) {
      console.log('❌ No users found in database');
    } else {
      console.log(`✅ Found ${users.length} users:`);
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email}`);
        console.log(`   Name: ${user.firstName || 'N/A'} ${user.lastName || 'N/A'}`);
        console.log(`   Created: ${user.createdAt}`);
        console.log('');
      });
    }
    
    // Kiểm tra cụ thể 2 email
    console.log('🔍 Checking specific emails:');
    console.log('───────────────────────────');
    
    const email1 = await User.findOne({ email: 'nghiaht28102003@gmail.com' });
    console.log(`nghiaht28102003@gmail.com: ${email1 ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    
    const email2 = await User.findOne({ email: 'hohuong15052005@gmail.com' });
    console.log(`hohuong15052005@gmail.com: ${email2 ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    
  } catch (error) {
    console.log('❌ Database error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Database connection closed');
  }
};

console.log('🚀 Checking Database Users');
console.log('🎯 Mục tiêu: Xác minh user nào tồn tại trong DB');

checkDatabaseUsers().then(() => {
  console.log('\n🏁 Database check completed!');
  process.exit(0);
});
