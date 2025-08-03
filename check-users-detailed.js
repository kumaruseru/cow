const mongoose = require('mongoose');
const User = require('./models/User');

async function checkUsers() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/cow-social');
    console.log('✅ Connected to MongoDB');

    const allUsers = await User.find({});
    console.log(`📊 Total users: ${allUsers.length}`);
    
    allUsers.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email}, Name: ${user.firstName} ${user.lastName}`);
      console.log(`   ID: ${user._id}`);
    });

    console.log('✅ User check complete');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkUsers();
