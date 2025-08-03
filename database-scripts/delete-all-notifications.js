const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/cow_social_network')
  .then(() => {
    console.log('✅ Connected to MongoDB');
  }).catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

async function deleteAllNotifications() {
  try {
    console.log('🗑️  Deleting all notifications...\n');
    
    // Count current notifications
    const totalCount = await Notification.countDocuments();
    console.log(`📊 Found ${totalCount} notifications in database`);
    
    if (totalCount === 0) {
      console.log('✅ No notifications to delete');
      return;
    }
    
    // Show some sample notifications before deletion
    const sampleNotifications = await Notification.find()
      .populate('sender', 'firstName lastName email')
      .populate('recipient', 'firstName lastName email')
      .limit(5)
      .lean();
    
    console.log('\n📋 Sample notifications to be deleted:');
    sampleNotifications.forEach((notif, index) => {
      const senderName = notif.sender ? 
        `${notif.sender.firstName || ''} ${notif.sender.lastName || ''}`.trim() || notif.sender.email :
        'Unknown';
      const recipientName = notif.recipient ? 
        `${notif.recipient.firstName || ''} ${notif.recipient.lastName || ''}`.trim() || notif.recipient.email :
        'Unknown';
        
      console.log(`${index + 1}. Type: ${notif.type}`);
      console.log(`   From: ${senderName} → To: ${recipientName}`);
      console.log(`   Message: ${notif.message}`);
      console.log(`   Date: ${notif.createdAt}`);
      console.log('   ---');
    });
    
    // Ask for confirmation
    console.log(`\n⚠️  About to delete ALL ${totalCount} notifications!`);
    console.log('This action cannot be undone.');
    
    // Delete all notifications
    const result = await Notification.deleteMany({});
    
    console.log(`\n🎉 Successfully deleted ${result.deletedCount} notifications!`);
    console.log('✅ All fake notifications have been removed from the system.');
    
    // Verify deletion
    const remainingCount = await Notification.countDocuments();
    console.log(`📊 Remaining notifications: ${remainingCount}`);
    
  } catch (error) {
    console.error('❌ Error deleting notifications:', error);
  } finally {
    mongoose.connection.close();
  }
}

deleteAllNotifications();
