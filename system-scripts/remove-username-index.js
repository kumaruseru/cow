const mongoose = require('mongoose');
require('dotenv').config();

async function removeUsernameIndex() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    
    // Connect to MongoDB and wait for connection
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/social_media');
    console.log('✅ Connected to MongoDB');
    
    console.log('🗂️ Checking existing indexes...');
    
    // Check existing indexes
    const indexes = await mongoose.connection.db.collection('users').indexes();
    console.log('📋 Current indexes:');
    indexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    // Drop username index if it exists
    try {
      await mongoose.connection.db.collection('users').dropIndex('username_1');
      console.log('✅ Successfully dropped username_1 index');
    } catch (error) {
      console.log('ℹ️ Username index does not exist or already dropped');
    }
    
    // Try to drop any other username-related indexes
    try {
      await mongoose.connection.db.collection('users').dropIndex({ username: 1 });
      console.log('✅ Successfully dropped username index');
    } catch (error) {
      console.log('ℹ️ No additional username index found');
    }
    
    console.log('🎉 Index cleanup completed!');
    
  } catch (error) {
    console.error('💥 Error removing indexes:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

// Run the cleanup
removeUsernameIndex();
