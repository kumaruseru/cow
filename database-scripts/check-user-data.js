const mongoose = require('mongoose');
const User = require('./src/models/User');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/cow', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function checkUserData() {
  try {
    console.log('🔍 Checking user data...');
    
    // Get all users
    const users = await User.find({}).select('username firstName lastName email');
    
    console.log(`📊 Found ${users.length} users:`);
    
    users.forEach((user, index) => {
      console.log(`\n👤 User ${index + 1}:`);
      console.log(`  ID: ${user._id}`);
      console.log(`  Username: ${user.username}`);
      console.log(`  First Name: ${user.firstName || 'NOT SET'}`);
      console.log(`  Last Name: ${user.lastName || 'NOT SET'}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Full Name: ${user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : 'INCOMPLETE'}`);
    });
    
    // Check for users without firstName or lastName
    const incompleteUsers = users.filter(user => !user.firstName || !user.lastName);
    
    if (incompleteUsers.length > 0) {
      console.log(`\n⚠️  Found ${incompleteUsers.length} users with incomplete names:`);
      incompleteUsers.forEach(user => {
        console.log(`  - ${user.username}: firstName=${user.firstName || 'MISSING'}, lastName=${user.lastName || 'MISSING'}`);
      });
    } else {
      console.log('\n✅ All users have complete name data');
    }
    
  } catch (error) {
    console.error('❌ Error checking user data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Database disconnected');
  }
}

checkUserData();
