const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/cow_social_network', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Connected to MongoDB');
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

async function checkNotificationData() {
  try {
    console.log('🔍 Checking notification data...\n');
    
    // Get some notifications with populated sender
    const notifications = await Notification.find()
      .populate('sender', 'firstName lastName email username')
      .limit(5)
      .lean();
    
    console.log('Sample notifications:');
    notifications.forEach((notif, index) => {
      console.log(`${index + 1}. Type: ${notif.type}`);
      console.log(`   Message: ${notif.message}`);
      console.log(`   Sender:`, notif.sender);
      console.log(`   Created: ${notif.createdAt}`);
      console.log('   ---');
    });
    
    // Count notifications by sender
    const senderStats = await Notification.aggregate([
      {
        $group: {
          _id: '$sender',
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'senderInfo'
        }
      },
      {
        $unwind: '$senderInfo'
      },
      {
        $project: {
          count: 1,
          'senderInfo.firstName': 1,
          'senderInfo.lastName': 1,
          'senderInfo.email': 1,
          'senderInfo.username': 1
        }
      }
    ]);
    
    console.log('\nNotifications by sender:');
    senderStats.forEach(stat => {
      console.log(`- ${stat.senderInfo.firstName || 'No firstName'} ${stat.senderInfo.lastName || 'No lastName'} (${stat.senderInfo.email}) - ${stat.count} notifications`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkNotificationData();
