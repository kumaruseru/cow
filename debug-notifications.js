const mongoose = require('mongoose');
const Notification = require('./models/Notification');

async function debugNotifications() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/cow-social');
    console.log('✅ Connected to MongoDB');

    // Get all notifications
    const notifications = await Notification.find({}).limit(10);
    console.log('\n📋 Current notifications:');
    notifications.forEach((notif, index) => {
      console.log(`${index + 1}. Type: ${notif.type}, Message: ${notif.message}`);
      console.log(`   RelatedPost: ${notif.relatedPost}, RelatedComment: ${notif.relatedComment}`);
      console.log(`   Sender: ${notif.sender}, Recipient: ${notif.recipient}`);
      console.log(`   Created: ${notif.createdAt}\n`);
    });

    // Check if any notifications have relatedPost
    const notificationsWithPost = await Notification.find({ relatedPost: { $ne: null } });
    console.log(`📊 Notifications with relatedPost: ${notificationsWithPost.length}`);

    if (notificationsWithPost.length > 0) {
      console.log('🔧 Fixing notifications with invalid post references...');
      await Notification.updateMany(
        { relatedPost: { $ne: null } },
        { $unset: { relatedPost: '' } }
      );
      console.log('✅ Cleared invalid post references');
    }

    console.log('\n✅ Debug complete');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

debugNotifications();
