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

// Display user data structure
const displayUserData = async () => {
  try {
    console.log('👥 USER DATA STRUCTURE OVERVIEW\n');
    
    const users = await User.find().sort({ createdAt: 1 });
    
    for (const user of users) {
      console.log(`🆔 USER: ${user.firstName} ${user.lastName} (${user.email})`);
      console.log(`   📧 Email: ${user.email}`);
      console.log(`   👤 Role: ${user.verified ? 'Admin' : 'User'}`);
      console.log(`   📍 Location: ${user.location || 'Not specified'}`);
      console.log(`   💬 Bio: ${user.bio || 'No bio'}`);
      console.log(`   📅 Joined: ${user.createdAt ? user.createdAt.toLocaleDateString() : 'Unknown'}`);
      
      // Get user's posts
      const posts = await Post.find({ author: user._id }).sort({ createdAt: -1 });
      console.log(`   📝 Posts: ${posts.length}`);
      
      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        console.log(`      ${i + 1}. "${post.content.substring(0, 60)}..."`);
        console.log(`         👍 Likes: ${post.likes.length}`);
        console.log(`         💬 Comments: ${post.comments.length}`);
        console.log(`         🔒 Privacy: ${post.privacy}`);
        console.log(`         🏷️  Tags: ${post.tags.join(', ') || 'None'}`);
        if (post.location) {
          console.log(`         📍 Location: ${post.location.name}`);
        }
        if (post.images && post.images.length > 0) {
          console.log(`         🖼️  Images: ${post.images.length}`);
        }
        console.log(`         📅 Posted: ${post.createdAt.toLocaleDateString()}`);
        console.log('');
      }
      
      // Get user's friends
      const friendships = await Friend.find({
        $or: [
          { requester: user._id, status: 'accepted' },
          { recipient: user._id, status: 'accepted' }
        ]
      }).populate('requester recipient', 'firstName lastName email');
      
      console.log(`   🤝 Friends: ${friendships.length}`);
      for (const friendship of friendships) {
        const friend = friendship.requester._id.equals(user._id) 
          ? friendship.recipient 
          : friendship.requester;
        console.log(`      • ${friend.firstName} ${friend.lastName} (${friend.email})`);
      }
      
      // Get user's conversations
      const conversations = await Message.find({
        $or: [
          { sender: user._id },
          { recipient: user._id }
        ]
      }).populate('sender recipient', 'firstName lastName email')
        .sort({ createdAt: -1 });
      
      const conversationMap = new Map();
      conversations.forEach(msg => {
        const otherUser = msg.sender._id.equals(user._id) ? msg.recipient : msg.sender;
        const key = otherUser.email;
        if (!conversationMap.has(key)) {
          conversationMap.set(key, {
            user: otherUser,
            messages: []
          });
        }
        conversationMap.get(key).messages.push(msg);
      });
      
      console.log(`   💬 Conversations: ${conversationMap.size}`);
      for (const [email, data] of conversationMap) {
        console.log(`      • With ${data.user.firstName} ${data.user.lastName}: ${data.messages.length} messages`);
        // Show latest message
        if (data.messages.length > 0) {
          const latest = data.messages[0];
          const sender = latest.sender._id.equals(user._id) ? 'You' : data.user.firstName;
          console.log(`        Latest: ${sender}: "${latest.content.substring(0, 40)}..."`);
        }
      }
      
      // Get user's notifications
      const notifications = await Notification.find({ userId: user._id })
        .populate('fromUserId', 'firstName lastName')
        .sort({ createdAt: -1 });
      
      console.log(`   🔔 Notifications: ${notifications.length}`);
      for (const notification of notifications) {
        const status = notification.read ? '✅' : '🔴';
        const fromUser = notification.fromUserId 
          ? `from ${notification.fromUserId.firstName} ${notification.fromUserId.lastName}` 
          : 'system';
        console.log(`      ${status} ${notification.type}: ${notification.message} (${fromUser})`);
      }
      
      console.log('\n' + '='.repeat(80) + '\n');
    }
    
    // Overall statistics
    const totalUsers = await User.countDocuments();
    const totalPosts = await Post.countDocuments();
    const totalMessages = await Message.countDocuments();
    const totalNotifications = await Notification.countDocuments();
    const totalFriendships = await Friend.countDocuments({ status: 'accepted' });
    
    console.log('📊 OVERALL STATISTICS:');
    console.log(`   👥 Total Users: ${totalUsers}`);
    console.log(`   📝 Total Posts: ${totalPosts}`);
    console.log(`   💬 Total Messages: ${totalMessages}`);
    console.log(`   🔔 Total Notifications: ${totalNotifications}`);
    console.log(`   🤝 Total Friendships: ${totalFriendships}`);
    
    // User engagement statistics
    console.log('\n📈 USER ENGAGEMENT:');
    for (const user of users) {
      const userPosts = await Post.countDocuments({ author: user._id });
      const userMessages = await Message.countDocuments({
        $or: [{ sender: user._id }, { recipient: user._id }]
      });
      const userFriends = await Friend.countDocuments({
        $or: [
          { requester: user._id, status: 'accepted' },
          { recipient: user._id, status: 'accepted' }
        ]
      });
      
      console.log(`   ${user.firstName}: ${userPosts} posts, ${userMessages} messages, ${userFriends} friends`);
    }
    
  } catch (error) {
    console.error('❌ Error displaying user data:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
};

// Connect and display data
const main = async () => {
  await connectDB();
  await displayUserData();
};

main();
