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

async function updateNotificationMessages() {
  try {
    console.log('🔄 Updating notification messages...\n');
    
    // Get all notifications with populated sender
    const notifications = await Promise.all([
      Notification.find().populate('sender', 'firstName lastName email username').lean(),
      User.find({}, 'firstName lastName email username').lean()
    ]);
    
    const allNotifications = notifications[0];
    const allUsers = notifications[1];
    
    console.log(`Found ${allNotifications.length} notifications to check`);
    
    let updatedCount = 0;
    
    for (const notification of allNotifications) {
      if (notification.sender) {
        const sender = notification.sender;
        const fullName = `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || sender.username;
        
        let newMessage = notification.message;
        let needsUpdate = false;
        
        // Update messages with old names
        if (notification.message.includes('User Name')) {
          newMessage = notification.message.replace(/User Name/g, fullName);
          needsUpdate = true;
        }
        
        if (notification.message.includes('Test User')) {
          newMessage = notification.message.replace(/Test User/g, fullName);
          needsUpdate = true;
        }
        
        // Also check for specific patterns and update with proper name
        const patterns = [
          { old: /^User Name đã/, new: `${fullName} đã` },
          { old: /^Test User đã/, new: `${fullName} đã` },
          { old: /User Name$/g, new: fullName },
          { old: /Test User$/g, new: fullName }
        ];
        
        for (const pattern of patterns) {
          if (pattern.old.test(newMessage)) {
            newMessage = newMessage.replace(pattern.old, pattern.new);
            needsUpdate = true;
          }
        }
        
        if (needsUpdate) {
          await Notification.updateOne(
            { _id: notification._id },
            { message: newMessage }
          );
          
          console.log(`✅ Updated: "${notification.message}" → "${newMessage}"`);
          updatedCount++;
        }
      }
    }
    
    console.log(`\n🎉 Updated ${updatedCount} notification messages`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

updateNotificationMessages();
