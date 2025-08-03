const mongoose = require('mongoose');
const User = require('./models/User');
const Message = require('./models/Message');

async function cleanupData() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/cow_social_network');
    console.log('✅ Connected to MongoDB');

    // Create some test messages for existing users
    const users = await User.find({}).limit(4);
    console.log(`📊 Found ${users.length} users for test messages`);

    if (users.length >= 2) {
      const user1 = users[0];
      const user2 = users[1];

      // Check if test messages already exist
      const existingMessages = await Message.find({
        $or: [
          { sender: user1._id, recipient: user2._id },
          { sender: user2._id, recipient: user1._id }
        ]
      });

      if (existingMessages.length === 0) {
        console.log('💬 Creating test messages between users...');
        
        await Message.create([
          {
            sender: user1._id,
            recipient: user2._id,
            content: 'Hello! How are you?',
            createdAt: new Date(Date.now() - 60000)
          },
          {
            sender: user2._id,
            recipient: user1._id,
            content: "Hi there! I'm doing well, thanks!",
            createdAt: new Date(Date.now() - 30000)
          },
          {
            sender: user1._id,
            recipient: user2._id,
            content: 'Great to hear!',
            createdAt: new Date()
          }
        ]);
        
        console.log('✅ Created test messages');
      } else {
        console.log(`📋 Found ${existingMessages.length} existing messages`);
      }
    }

    console.log('✅ Data cleanup complete');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

cleanupData();
