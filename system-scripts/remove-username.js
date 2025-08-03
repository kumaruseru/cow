const mongoose = require('mongoose');
require('dotenv').config();

async function removeUsernameField() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    
    // Connect to MongoDB and wait for connection
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/social_media');
    console.log('✅ Connected to MongoDB');
    
    console.log('🗑️ Starting username field removal...');
    
    // Remove username field from all users
    const result = await mongoose.connection.db.collection('users').updateMany(
      {}, 
      { $unset: { username: '' } }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} users - removed username field`);
    
    // List all users to verify
    const users = await mongoose.connection.db.collection('users').find({}).toArray();
    console.log('📋 Current users in database:');
    users.forEach(user => {
      console.log(`  - ${user.firstName} ${user.lastName} (${user.email})`);
      if (user.username) {
        console.log(`    ⚠️ Still has username: ${user.username}`);
      } else {
        console.log(`    ✅ Username field removed`);
      }
    });
    
    console.log('🎉 Username field removal completed!');
    
  } catch (error) {
    console.error('💥 Error removing username field:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

// Run the cleanup
removeUsernameField();
