const mongoose = require('mongoose');
const User = require('../models/SimpleUser');

async function checkUserNames() {
  try {
    await mongoose.connect('mongodb://localhost:27017/cow_social_network');
    console.log('✅ Connected to MongoDB');

    const users = await User.find({}).limit(5);
    console.log('📊 Sample users in database:');
    
    users.forEach((user, index) => {
      console.log(`\n👤 User ${index + 1}:`);
      console.log(`   ID: ${user._id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   First Name: ${user.firstName || 'NOT SET'}`);
      console.log(`   Last Name: ${user.lastName || 'NOT SET'}`);
      console.log(`   Full Name: ${user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : 'NO NAME'}`);
    });

    // Count users without names
    const usersWithoutNames = await User.countDocuments({
      $or: [
        { firstName: { $exists: false } },
        { lastName: { $exists: false } },
        { firstName: null },
        { lastName: null },
        { firstName: '' },
        { lastName: '' }
      ]
    });

    console.log(`\n📈 Statistics:`);
    console.log(`   Total users: ${users.length}`);
    console.log(`   Users without proper names: ${usersWithoutNames}`);

    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkUserNames();
