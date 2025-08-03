const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
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

// Clear all collections
const clearDatabase = async () => {
  console.log('🗑️  Clearing existing data...');
  
  const collections = await mongoose.connection.db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);
  
  for (const collectionName of collectionNames) {
    await mongoose.connection.db.collection(collectionName).deleteMany({});
    console.log(`   ✅ Cleared ${collectionName} collection`);
  }
};

// Create sample users
const createUsers = async () => {
  console.log('👥 Creating sample users...');
  
  const users = [
    {
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@cow.com',
      password: 'admin123',
      bio: 'Administrator of Cow Social Network',
      verified: true
    },
    {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password: '123456',
      bio: 'Software developer and tech enthusiast',
      location: 'Ho Chi Minh City, Vietnam'
    },
    {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      password: '123456',
      bio: 'UI/UX Designer with passion for beautiful interfaces',
      location: 'Hanoi, Vietnam'
    },
    {
      firstName: 'Mike',
      lastName: 'Johnson',
      email: 'mike@example.com',
      password: '123456',
      bio: 'Digital marketing expert and content creator',
      location: 'Da Nang, Vietnam'
    },
    {
      firstName: 'Sarah',
      lastName: 'Wilson',
      email: 'sarah@example.com',
      password: '123456',
      bio: 'Photographer and travel blogger',
      location: 'Nha Trang, Vietnam'
    }
  ];
  
  const createdUsers = [];
  
  for (const userData of users) {
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(userData.password, saltRounds);
    
    const user = await User.create({
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
      passwordHash: passwordHash,
      bio: userData.bio,
      location: userData.location,
      verified: userData.verified || false
    });
    
    createdUsers.push(user);
    console.log(`   ✅ Created user: ${user.firstName} ${user.lastName} (${user.email})`);
  }
  
  return createdUsers;
};

// Create sample posts
const createPosts = async (users) => {
  console.log('📝 Creating sample posts...');
  
  const samplePosts = [
    {
      content: 'Welcome to Cow Social Network! 🐄 Excited to be here and connect with everyone!',
      author: users[0]._id,
      privacy: 'public',
      tags: ['welcome', 'excited']
    },
    {
      content: 'Just finished working on a new React project. The component architecture is so clean! #coding #react',
      author: users[1]._id,
      privacy: 'public',
      location: {
        name: 'Saigon Skydeck',
        address: 'Bitexco Financial Tower, Ho Chi Minh City, Vietnam',
        lat: 10.7714,
        lng: 106.7044
      }
    },
    {
      content: 'Beautiful sunset from my office window today 🌅 Sometimes the best inspiration comes from nature.',
      author: users[2]._id,
      privacy: 'public'
    },
    {
      content: 'Digital marketing tip: Always A/B test your campaigns! Data-driven decisions lead to better results 📊',
      author: users[3]._id,
      privacy: 'public',
      tags: ['marketing', 'tips']
    },
    {
      content: 'Exploring the ancient temples of Hoi An. The architecture here is absolutely stunning! 🏛️',
      author: users[4]._id,
      privacy: 'public',
      location: {
        name: 'Hoi An Ancient Town',
        address: 'Hoi An, Quang Nam, Vietnam',
        lat: 15.8801,
        lng: 108.3380
      }
    },
    {
      content: 'Coffee break ☕ What\'s your favorite coding fuel?',
      author: users[1]._id,
      privacy: 'public'
    },
    {
      content: 'Working on some new UI mockups. Clean design is the key to great user experience! ✨',
      author: users[2]._id,
      privacy: 'friends'
    },
    {
      content: 'Sharing some photography tips: Golden hour is your best friend for outdoor portraits 📸',
      author: users[4]._id,
      privacy: 'public',
      tags: ['photography', 'tips']
    }
  ];
  
  const createdPosts = [];
  
  for (const postData of samplePosts) {
    const post = await Post.create(postData);
    createdPosts.push(post);
    console.log(`   ✅ Created post by ${users.find(u => u._id.equals(post.author)).firstName}`);
  }
  
  return createdPosts;
};

// Add likes and comments to posts
const addInteractions = async (users, posts) => {
  console.log('👍 Adding likes and comments...');
  
  // Add some likes
  await posts[0].addLike(users[1]._id);
  await posts[0].addLike(users[2]._id);
  await posts[0].addLike(users[3]._id);
  
  await posts[1].addLike(users[0]._id);
  await posts[1].addLike(users[2]._id);
  
  await posts[2].addLike(users[1]._id);
  await posts[2].addLike(users[3]._id);
  await posts[2].addLike(users[4]._id);
  
  // Add some comments
  await posts[0].addComment(users[1]._id, 'Great to see you here! Welcome! 🎉');
  await posts[0].addComment(users[2]._id, 'Looking forward to connecting with everyone!');
  
  await posts[1].addComment(users[2]._id, 'React is amazing! What library did you use for state management?');
  await posts[1].addComment(users[1]._id, 'Thanks! I used Redux Toolkit for this project.');
  
  await posts[2].addComment(users[1]._id, 'Beautiful view! 😍');
  await posts[2].addComment(users[4]._id, 'Nature is the best inspiration indeed!');
  
  await posts[4].addComment(users[0]._id, 'Hoi An is incredible! Great photo!');
  await posts[4].addComment(users[2]._id, 'Added to my travel bucket list! 📝');
  
  console.log('   ✅ Added likes and comments to posts');
};

// Create friend relationships
const createFriendships = async (users) => {
  console.log('🤝 Creating friend relationships...');
  
  const friendships = [
    [users[0], users[1]], // Admin <-> John
    [users[1], users[2]], // John <-> Jane
    [users[2], users[3]], // Jane <-> Mike
    [users[3], users[4]], // Mike <-> Sarah
    [users[0], users[4]], // Admin <-> Sarah
    [users[1], users[4]]  // John <-> Sarah
  ];
  
  for (const [user1, user2] of friendships) {
    try {
      await Friend.create({
        requester: user1._id,
        recipient: user2._id,
        status: 'accepted'
      });
      console.log(`   ✅ Created friendship: ${user1.firstName} <-> ${user2.firstName}`);
    } catch (error) {
      // Friendship might already exist
    }
  }
};

// Create sample notifications
const createNotifications = async (users, posts) => {
  console.log('🔔 Creating sample notifications...');
  
  const notifications = [
    {
      userId: users[0]._id,
      type: 'like',
      message: 'John Doe liked your post',
      fromUserId: users[1]._id,
      postId: posts[0]._id,
      read: false
    },
    {
      userId: users[1]._id,
      type: 'comment',
      message: 'Jane Smith commented on your post',
      fromUserId: users[2]._id,
      postId: posts[1]._id,
      read: false
    },
    {
      userId: users[2]._id,
      type: 'friend_request',
      message: 'Mike Johnson sent you a friend request',
      fromUserId: users[3]._id,
      read: true
    }
  ];
  
  for (const notificationData of notifications) {
    try {
      await Notification.create(notificationData);
      console.log('   ✅ Created notification');
    } catch (error) {
      console.log('   ⚠️  Notification creation failed:', error.message);
    }
  }
};

// Create sample messages
const createMessages = async (users) => {
  console.log('💬 Creating sample messages...');
  
  const messages = [
    {
      sender: users[0]._id,
      recipient: users[1]._id,
      content: 'Hey John! Welcome to the platform!',
      conversationId: `${users[0]._id}_${users[1]._id}`
    },
    {
      sender: users[1]._id,
      recipient: users[0]._id,
      content: 'Thanks! Great to be here. The platform looks amazing!',
      conversationId: `${users[0]._id}_${users[1]._id}`
    },
    {
      sender: users[2]._id,
      recipient: users[3]._id,
      content: 'Hi Mike! Loved your marketing tips post 👍',
      conversationId: `${users[2]._id}_${users[3]._id}`
    },
    {
      sender: users[3]._id,
      recipient: users[2]._id,
      content: 'Thank you Jane! I have more tips coming soon 😊',
      conversationId: `${users[2]._id}_${users[3]._id}`
    }
  ];
  
  for (const messageData of messages) {
    try {
      await Message.create(messageData);
      console.log('   ✅ Created message');
    } catch (error) {
      console.log('   ⚠️  Message creation failed:', error.message);
    }
  }
};

// Main function to setup database
const setupDatabase = async () => {
  try {
    console.log('🚀 Starting database setup...\n');
    
    await connectDB();
    
    // Ask for confirmation before clearing
    console.log('⚠️  WARNING: This will delete ALL existing data!');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await clearDatabase();
    console.log('');
    
    const users = await createUsers();
    console.log('');
    
    const posts = await createPosts(users);
    console.log('');
    
    await addInteractions(users, posts);
    console.log('');
    
    await createFriendships(users);
    console.log('');
    
    await createNotifications(users, posts);
    console.log('');
    
    await createMessages(users);
    console.log('');
    
    console.log('✅ Database setup completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   👥 Users: ${users.length}`);
    console.log(`   📝 Posts: ${posts.length}`);
    console.log(`   🤝 Friendships: Created multiple relationships`);
    console.log(`   🔔 Notifications: Sample notifications added`);
    console.log(`   💬 Messages: Sample conversations created`);
    
    console.log('\n🔑 Login credentials:');
    console.log('   📧 admin@cow.com / admin123 (Admin)');
    console.log('   📧 john@example.com / 123456');
    console.log('   📧 jane@example.com / 123456');
    console.log('   📧 mike@example.com / 123456');
    console.log('   📧 sarah@example.com / 123456');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
};

// Run setup
setupDatabase();
