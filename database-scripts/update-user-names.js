const mongoose = require('mongoose');
const User = require('../models/SimpleUser');

async function updateUserNames() {
  try {
    await mongoose.connect('mongodb://localhost:27017/cow_social_network');
    console.log('✅ Connected to MongoDB');

    // Update admin user with proper name
    const adminUpdate = await User.updateOne(
      { email: 'admin@cow.com' },
      { 
        firstName: 'Admin',
        lastName: 'Cow Social'
      }
    );

    if (adminUpdate.modifiedCount > 0) {
      console.log('✅ Updated admin user name: Admin Cow Social');
    } else {
      console.log('⚠️ Admin user not found or already updated');
    }

    // Update any other users with generic names
    const genericUpdate = await User.updateMany(
      { 
        $or: [
          { firstName: 'User', lastName: 'Name' },
          { firstName: 'Test', lastName: 'User' },
          { firstName: 'JWT', lastName: 'Test' }
        ]
      },
      { 
        firstName: 'Người dùng',
        lastName: 'Hệ thống'
      }
    );

    if (genericUpdate.modifiedCount > 0) {
      console.log(`✅ Updated ${genericUpdate.modifiedCount} users with generic names`);
    }

    // Show updated users
    const updatedUsers = await User.find({}).limit(5);
    console.log('\n📊 Updated users:');
    
    updatedUsers.forEach((user, index) => {
      console.log(`👤 User ${index + 1}: ${user.firstName} ${user.lastName} (${user.email})`);
    });

    mongoose.connection.close();
    console.log('\n✅ Database updated successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateUserNames();
