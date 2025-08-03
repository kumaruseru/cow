const mongoose = require('mongoose');
require('dotenv').config();

// Import all models
const User = require('../models/SimpleUser');
const Post = require('../models/Post');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const Friend = require('../models/Friend');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cow_social_network');
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Simple data overview
const showDataOverview = async () => {
  try {
    console.log('📊 COW SOCIAL NETWORK - ORGANIZED USER DATA\n');
    
    const users = await User.find().sort({ email: 1 });
    
    for (const user of users) {
      console.log(`👤 ${user.firstName} ${user.lastName} (${user.email})`);
      console.log(`   🔑 Role: ${user.verified ? 'Administrator' : 'Regular User'}`);
      console.log(`   📍 Location: ${user.location || 'Not specified'}`);
      console.log(`   💬 Bio: ${user.bio}`);
      
      // Count user's content
      const postsCount = await Post.countDocuments({ author: user._id });
      const messagesCount = await Message.countDocuments({
        $or: [{ sender: user._id }, { recipient: user._id }]
      });
      const notificationsCount = await Notification.countDocuments({ userId: user._id });
      const friendsCount = await Friend.countDocuments({
        $or: [
          { requester: user._id, status: 'accepted' },
          { recipient: user._id, status: 'accepted' }
        ]
      });
      
      console.log(`   📊 Content:`);
      console.log(`      📝 Posts: ${postsCount}`);
      console.log(`      💬 Messages: ${messagesCount}`);
      console.log(`      🔔 Notifications: ${notificationsCount}`);
      console.log(`      🤝 Friends: ${friendsCount}`);
      
      // Show recent posts
      const recentPosts = await Post.find({ author: user._id })
        .sort({ createdAt: -1 })
        .limit(3);
      
      if (recentPosts.length > 0) {
        console.log(`   📝 Recent Posts:`);
        recentPosts.forEach((post, index) => {
          console.log(`      ${index + 1}. "${post.content.substring(0, 50)}..."`);
          console.log(`         👍 ${post.likes.length} likes, 💬 ${post.comments.length} comments`);
          if (post.location) {
            console.log(`         📍 ${post.location.name}`);
          }
        });
      }
      
      console.log('   ' + '-'.repeat(60));
      console.log('');
    }
    
    // Overall statistics
    const stats = {
      users: await User.countDocuments(),
      posts: await Post.countDocuments(),
      messages: await Message.countDocuments(),
      notifications: await Notification.countDocuments(),
      friendships: await Friend.countDocuments({ status: 'accepted' })
    };
    
    console.log('📈 PLATFORM STATISTICS:');
    console.log(`   👥 Total Users: ${stats.users}`);
    console.log(`   📝 Total Posts: ${stats.posts}`);
    console.log(`   💬 Total Messages: ${stats.messages}`);
    console.log(`   🔔 Total Notifications: ${stats.notifications}`);
    console.log(`   🤝 Total Friendships: ${stats.friendships}`);
    
    console.log('\n🎯 USER DATA ORGANIZATION BENEFITS:');
    console.log('   ✅ Each user has their own data ecosystem');
    console.log('   ✅ Easy to track user activity and content');
    console.log('   ✅ Clear data ownership and privacy');
    console.log('   ✅ Efficient queries and data management');
    console.log('   ✅ Scalable architecture for growth');
    
    console.log('\n🔄 USER MANAGEMENT FEATURES:');
    console.log('   📊 Individual user analytics');
    console.log('   🗂️  Organized content by user');
    console.log('   🔐 User-specific privacy settings');
    console.log('   📈 User engagement tracking');
    console.log('   🎨 Personalized user experience');
    
  } catch (error) {
    console.error('❌ Error displaying data:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
};

// Main function
const main = async () => {
  await connectDB();
  await showDataOverview();
};

main();
