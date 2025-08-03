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

// Create organized user data structure
const createOrganizedUserData = async () => {
  console.log('👥 Creating organized user data...');
  
  const userData = [
    {
      // User 1: Admin
      profile: {
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@cow.com',
        password: 'admin123',
        bio: 'Administrator of Cow Social Network 👑',
        location: 'Ho Chi Minh City, Vietnam',
        verified: true,
        joinDate: new Date('2024-01-01'),
        avatar: null,
        cover: null,
        settings: {
          privacy: 'public',
          emailNotifications: true,
          pushNotifications: true,
          language: 'vi'
        }
      },
      posts: [
        {
          content: '🎉 Chào mừng đến với Cow Social Network! Hệ thống mạng xã hội mới với đầy đủ tính năng hiện đại.',
          privacy: 'public',
          tags: ['welcome', 'announcement'],
          images: [],
          location: null
        },
        {
          content: '📢 Hướng dẫn sử dụng:\n• Upload ảnh bằng cách kéo thả\n• Thêm vị trí cho bài viết\n• Nhắn tin với bạn bè\n• Tương tác qua like và comment',
          privacy: 'public',
          tags: ['tutorial', 'guide'],
          images: [],
          location: null
        }
      ],
      friends: ['john@example.com', 'sarah@example.com'],
      conversations: [
        {
          with: 'john@example.com',
          messages: [
            {
              content: 'Chào John! Chào mừng bạn đến với platform! 👋',
              timestamp: new Date('2025-08-01T10:00:00Z'),
              sender: 'admin'
            },
            {
              content: 'Cảm ơn Admin! Platform trông rất tuyệt vời! 😊',
              timestamp: new Date('2025-08-01T10:05:00Z'),
              sender: 'recipient'
            }
          ]
        }
      ],
      notifications: [
        {
          type: 'system',
          message: 'Chào mừng bạn đến với Cow Social Network!',
          read: true,
          data: { type: 'welcome' }
        }
      ]
    },
    
    {
      // User 2: John Doe - Developer
      profile: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: '123456',
        bio: 'Full-stack Developer 💻 | React & Node.js enthusiast | Coffee lover ☕',
        location: 'District 1, Ho Chi Minh City',
        verified: false,
        joinDate: new Date('2025-01-15'),
        avatar: null,
        cover: null,
        settings: {
          privacy: 'public',
          emailNotifications: true,
          pushNotifications: true,
          language: 'en'
        }
      },
      posts: [
        {
          content: 'Vừa hoàn thành một dự án React mới! 🚀 Component architecture thực sự sạch và dễ maintain. #coding #react #javascript',
          privacy: 'public',
          tags: ['coding', 'react', 'javascript'],
          images: [],
          location: {
            name: 'Saigon Skydeck',
            address: 'Bitexco Financial Tower, Ho Chi Minh City, Vietnam',
            lat: 10.7714,
            lng: 106.7044
          }
        },
        {
          content: 'Coffee break time! ☕ Ai có gợi ý coffee shop nào ngon ở Sài Gòn không? #coffee #saigon',
          privacy: 'public',
          tags: ['coffee', 'saigon', 'break'],
          images: [],
          location: null
        },
        {
          content: 'Đang học thêm về Node.js performance optimization. Có ai có kinh nghiệm về clustering không? 🤔',
          privacy: 'friends',
          tags: ['nodejs', 'performance', 'question'],
          images: [],
          location: null
        }
      ],
      friends: ['admin@cow.com', 'jane@example.com', 'sarah@example.com'],
      conversations: [
        {
          with: 'jane@example.com',
          messages: [
            {
              content: 'Hey Jane! Bạn có thể review UI mockup mới không?',
              timestamp: new Date('2025-08-02T14:30:00Z'),
              sender: 'john'
            },
            {
              content: 'Chắc chắn rồi! Gửi link cho tôi nhé 😊',
              timestamp: new Date('2025-08-02T14:35:00Z'),
              sender: 'recipient'
            }
          ]
        }
      ],
      notifications: [
        {
          type: 'like',
          message: 'Jane Smith đã thích bài viết của bạn',
          fromUser: 'jane@example.com',
          read: false,
          data: { postIndex: 0 }
        },
        {
          type: 'comment',
          message: 'Admin đã bình luận về bài viết của bạn',
          fromUser: 'admin@cow.com',
          read: false,
          data: { postIndex: 1 }
        }
      ]
    },
    
    {
      // User 3: Jane Smith - Designer
      profile: {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        password: '123456',
        bio: 'UI/UX Designer 🎨 | Creating beautiful & functional interfaces | Figma expert',
        location: 'District 3, Ho Chi Minh City',
        verified: false,
        joinDate: new Date('2025-02-01'),
        avatar: null,
        cover: null,
        settings: {
          privacy: 'public',
          emailNotifications: true,
          pushNotifications: false,
          language: 'en'
        }
      },
      posts: [
        {
          content: 'Hoàng hôn tuyệt đẹp từ cửa sổ văn phòng hôm nay 🌅 Đôi khi cảm hứng tốt nhất đến từ thiên nhiên!',
          privacy: 'public',
          tags: ['sunset', 'inspiration', 'office'],
          images: [],
          location: null
        },
        {
          content: 'Đang làm việc với một số UI mockup mới. Clean design là chìa khóa cho UX tuyệt vời! ✨ #design #ui #ux',
          privacy: 'friends',
          tags: ['design', 'ui', 'ux'],
          images: [],
          location: null
        },
        {
          content: 'Design tip của ngày: Luôn nghĩ về user journey trước khi bắt đầu thiết kế giao diện! 🎯',
          privacy: 'public',
          tags: ['design', 'tips', 'ux'],
          images: [],
          location: null
        }
      ],
      friends: ['john@example.com', 'mike@example.com'],
      conversations: [
        {
          with: 'mike@example.com',
          messages: [
            {
              content: 'Hi Mike! Tôi thích post marketing tips của bạn! 👍',
              timestamp: new Date('2025-08-02T16:00:00Z'),
              sender: 'jane'
            },
            {
              content: 'Cảm ơn Jane! Tôi sẽ có thêm nhiều tips nữa sớm thôi 😊',
              timestamp: new Date('2025-08-02T16:10:00Z'),
              sender: 'recipient'
            }
          ]
        }
      ],
      notifications: [
        {
          type: 'friend_request',
          message: 'Mike Johnson đã gửi lời mời kết bạn',
          fromUser: 'mike@example.com',
          read: true,
          data: { status: 'accepted' }
        }
      ]
    },
    
    {
      // User 4: Mike Johnson - Marketer
      profile: {
        firstName: 'Mike',
        lastName: 'Johnson',
        email: 'mike@example.com',
        password: '123456',
        bio: 'Digital Marketing Expert 📊 | Content Creator | SEO Specialist | Growth Hacker',
        location: 'District 7, Ho Chi Minh City',
        verified: false,
        joinDate: new Date('2025-02-15'),
        avatar: null,
        cover: null,
        settings: {
          privacy: 'public',
          emailNotifications: true,
          pushNotifications: true,
          language: 'en'
        }
      },
      posts: [
        {
          content: 'Digital marketing tip: Luôn A/B test campaigns của bạn! 📊 Quyết định dựa trên data sẽ mang lại kết quả tốt hơn. #marketing #tips #data',
          privacy: 'public',
          tags: ['marketing', 'tips', 'data'],
          images: [],
          location: null
        },
        {
          content: 'Content is king, but distribution is queen! 👑 Bạn có thể tạo content tuyệt vời nhưng nếu không có strategy phân phối thì cũng vô ích.',
          privacy: 'public',
          tags: ['content', 'marketing', 'strategy'],
          images: [],
          location: null
        }
      ],
      friends: ['jane@example.com', 'sarah@example.com'],
      conversations: [],
      notifications: [
        {
          type: 'like',
          message: 'Sarah Wilson đã thích bài viết của bạn',
          fromUser: 'sarah@example.com',
          read: false,
          data: { postIndex: 0 }
        }
      ]
    },
    
    {
      // User 5: Sarah Wilson - Photographer
      profile: {
        firstName: 'Sarah',
        lastName: 'Wilson',
        email: 'sarah@example.com',
        password: '123456',
        bio: 'Travel Photographer 📸 | Capturing moments around Vietnam | Instagram: @sarahwilson_vn',
        location: 'Nha Trang, Vietnam',
        verified: false,
        joinDate: new Date('2025-03-01'),
        avatar: null,
        cover: null,
        settings: {
          privacy: 'public',
          emailNotifications: false,
          pushNotifications: true,
          language: 'en'
        }
      },
      posts: [
        {
          content: 'Khám phá những ngôi đền cổ ở Hội An. Kiến trúc ở đây thực sự tuyệt đẹp! 🏛️ #hoian #travel #photography',
          privacy: 'public',
          tags: ['hoian', 'travel', 'photography'],
          images: [],
          location: {
            name: 'Hoi An Ancient Town',
            address: 'Hoi An, Quang Nam, Vietnam',
            lat: 15.8801,
            lng: 108.3380
          }
        },
        {
          content: 'Photography tip: Golden hour là người bạn tốt nhất cho outdoor portraits! 📸✨ #photography #tips',
          privacy: 'public',
          tags: ['photography', 'tips', 'golden-hour'],
          images: [],
          location: null
        },
        {
          content: 'Nha Trang sunrise this morning was absolutely magical! 🌅 Sometimes you have to wake up early for the best shots.',
          privacy: 'friends',
          tags: ['nhatrang', 'sunrise', 'photography'],
          images: [],
          location: null
        }
      ],
      friends: ['admin@cow.com', 'john@example.com', 'mike@example.com'],
      conversations: [
        {
          with: 'admin@cow.com',
          messages: [
            {
              content: 'Chào Admin! Platform này tuyệt vời quá! 🎉',
              timestamp: new Date('2025-08-03T09:00:00Z'),
              sender: 'sarah'
            },
            {
              content: 'Cảm ơn Sarah! Hy vọng bạn sẽ chia sẻ nhiều ảnh đẹp nữa! 📸',
              timestamp: new Date('2025-08-03T09:05:00Z'),
              sender: 'recipient'
            }
          ]
        }
      ],
      notifications: [
        {
          type: 'comment',
          message: 'Admin đã bình luận về bài viết của bạn',
          fromUser: 'admin@cow.com',
          read: false,
          data: { postIndex: 0, comment: 'Hội An thật tuyệt! Ảnh đẹp quá! 📸' }
        }
      ]
    }
  ];
  
  return userData;
};

// Save organized data to database
const saveToDatabase = async (userData) => {
  console.log('💾 Saving organized data to database...');
  
  const createdUsers = [];
  const userEmailToId = {};
  
  // First pass: Create all users
  for (const userInfo of userData) {
    const { profile } = userInfo;
    
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(profile.password, saltRounds);
    
    const user = await User.create({
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      passwordHash: passwordHash,
      bio: profile.bio,
      location: profile.location,
      verified: profile.verified,
      avatar: profile.avatar,
      cover: profile.cover,
      settings: profile.settings,
      createdAt: profile.joinDate
    });
    
    createdUsers.push(user);
    userEmailToId[profile.email] = user._id;
    
    console.log(`   ✅ Created user: ${user.firstName} ${user.lastName} (${user.email})`);
  }
  
  // Second pass: Create posts for each user
  for (let i = 0; i < userData.length; i++) {
    const userInfo = userData[i];
    const user = createdUsers[i];
    
    for (const postData of userInfo.posts) {
      const post = await Post.create({
        content: postData.content,
        author: user._id,
        privacy: postData.privacy,
        tags: postData.tags,
        images: postData.images,
        location: postData.location
      });
      
      console.log(`   📝 Created post for ${user.firstName}: "${postData.content.substring(0, 50)}..."`);
    }
  }
  
  // Third pass: Create friendships
  for (let i = 0; i < userData.length; i++) {
    const userInfo = userData[i];
    const user = createdUsers[i];
    
    for (const friendEmail of userInfo.friends) {
      if (userEmailToId[friendEmail]) {
        try {
          await Friend.create({
            requester: user._id,
            recipient: userEmailToId[friendEmail],
            status: 'accepted',
            acceptedAt: new Date()
          });
          
          console.log(`   🤝 Created friendship: ${user.firstName} <-> ${friendEmail}`);
        } catch (error) {
          // Friendship might already exist
        }
      }
    }
  }
  
  // Fourth pass: Create messages
  for (let i = 0; i < userData.length; i++) {
    const userInfo = userData[i];
    const user = createdUsers[i];
    
    for (const conversation of userInfo.conversations) {
      const recipientId = userEmailToId[conversation.with];
      if (recipientId) {        
        const conversationId = `${user._id}_${recipientId}`;
        
        for (const messageData of conversation.messages) {
          const senderId = messageData.sender === 'john' || messageData.sender === 'jane' || messageData.sender === 'sarah' || messageData.sender === 'admin' 
            ? user._id 
            : recipientId;
          
          await Message.create({
            sender: senderId,
            recipient: senderId === user._id ? recipientId : user._id,
            content: messageData.content,
            conversationId: conversationId,
            createdAt: messageData.timestamp
          });
          
          console.log(`   💬 Created message in conversation ${user.firstName} <-> ${conversation.with}`);
        }
      }
    }
  }
  
  // Fifth pass: Create notifications
  for (let i = 0; i < userData.length; i++) {
    const userInfo = userData[i];
    const user = createdUsers[i];
    
    for (const notificationData of userInfo.notifications) {
      const fromUserId = notificationData.fromUser ? userEmailToId[notificationData.fromUser] : null;
      
      await Notification.create({
        userId: user._id,
        fromUserId: fromUserId,
        type: notificationData.type,
        message: notificationData.message,
        read: notificationData.read,
        data: notificationData.data
      });
      
      console.log(`   🔔 Created notification for ${user.firstName}`);
    }
  }
  
  return createdUsers;
};

// Add interactions (likes, comments)
const addInteractions = async (users) => {
  console.log('👍 Adding realistic interactions...');
  
  // Get all posts
  const posts = await Post.find().populate('author');
  
  // Add likes
  for (const post of posts) {
    const randomUsers = users.filter(u => !u._id.equals(post.author._id))
                           .sort(() => 0.5 - Math.random())
                           .slice(0, Math.floor(Math.random() * 3) + 1);
    
    for (const user of randomUsers) {
      await post.addLike(user._id);
    }
    
    console.log(`   👍 Added ${randomUsers.length} likes to post by ${post.author.firstName}`);
  }
  
  // Add comments
  const comments = [
    'Bài viết hay quá! 👍',
    'Cảm ơn bạn đã chia sẻ! 😊',
    'Thông tin rất hữu ích!',
    'Amazing content! 🔥',
    'Keep it up! 💪',
    'Tuyệt vời! 🎉',
    'Very inspiring! ✨',
    'Learnt something new today! 📚'
  ];
  
  for (const post of posts) {
    const numComments = Math.floor(Math.random() * 3);
    const randomUsers = users.filter(u => !u._id.equals(post.author._id))
                           .sort(() => 0.5 - Math.random())
                           .slice(0, numComments);
    
    for (const user of randomUsers) {
      const randomComment = comments[Math.floor(Math.random() * comments.length)];
      await post.addComment(user._id, randomComment);
    }
    
    if (numComments > 0) {
      console.log(`   💬 Added ${numComments} comments to post by ${post.author.firstName}`);
    }
  }
};

// Main function
const reorganizeUserData = async () => {
  try {
    console.log('🚀 Starting user data reorganization...\n');
    
    await connectDB();
    
    console.log('⚠️  WARNING: This will reorganize ALL user data!');
    console.log('Each user will have their own organized data structure.');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await clearDatabase();
    console.log('');
    
    const userData = await createOrganizedUserData();
    console.log('');
    
    const users = await saveToDatabase(userData);
    console.log('');
    
    await addInteractions(users);
    console.log('');
    
    console.log('✅ User data reorganization completed successfully!');
    console.log('\n📊 Organized Data Structure:');
    console.log('   👤 Each user has complete profile information');
    console.log('   📝 Posts are linked to specific users');
    console.log('   🤝 Friend relationships are properly mapped');
    console.log('   💬 Conversations show clear message threads');
    console.log('   🔔 Notifications are user-specific');
    console.log('   ⚙️  User settings and preferences included');
    
    console.log('\n🔑 Login credentials remain the same:');
    console.log('   📧 admin@cow.com / admin123 (Admin)');
    console.log('   📧 john@example.com / 123456 (Developer)');
    console.log('   📧 jane@example.com / 123456 (Designer)');
    console.log('   📧 mike@example.com / 123456 (Marketer)');
    console.log('   📧 sarah@example.com / 123456 (Photographer)');
    
    console.log('\n🎯 Benefits of this organization:');
    console.log('   ✅ Easy user content management');
    console.log('   ✅ Clear data ownership');
    console.log('   ✅ Realistic user interactions');
    console.log('   ✅ Professional user profiles');
    console.log('   ✅ Organized conversation threads');
    
  } catch (error) {
    console.error('❌ Data reorganization failed:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
};

// Run reorganization
reorganizeUserData();
