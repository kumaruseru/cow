const mongoose = require('mongoose');
require('dotenv').config();

async function checkDatabase() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    
    // Connect to MongoDB and wait for connection
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/social_media');
    console.log('✅ Connected to MongoDB');
    
    console.log('🔍 Checking database status...');
    
    // List all users
    const users = await mongoose.connection.db.collection('users').find({}).toArray();
    console.log(`📊 Total users: ${users.length}`);
    
    users.forEach((user, index) => {
      console.log(`\n👤 User ${index + 1}:`);
      console.log(`  - Name: ${user.firstName} ${user.lastName}`);
      console.log(`  - Email: ${user.email}`);
      console.log(`  - Has username: ${user.username ? '✅ YES' : '❌ NO'}`);
      if (user.username) {
        console.log(`  - Username value: "${user.username}"`);
      }
    });
    
    console.log('\n🎉 Database check completed!');
    
  } catch (error) {
    console.error('💥 Error checking database:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

// Run the check
checkDatabase();
