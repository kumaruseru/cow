const { MongoClient, ObjectId } = require('mongodb');

async function createPostsStructure() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('cow_social_network');
    
    console.log('=== Creating posts collection ===');
    
    // Lấy users để tạo sample posts
    const users = await db.collection('users').find({}).limit(3).toArray();
    
    if (users.length >= 2) {
      const user1 = users[0];
      const user2 = users[1];
      const user3 = users.length > 2 ? users[2] : user1;
      
      // Tạo sample posts
      const samplePosts = [
        {
          author: new ObjectId(user1._id),
          content: 'Chào mọi người! Đây là bài viết đầu tiên của tôi trên Cow Social Network 🐄',
          type: 'text',
          visibility: 'public',
          likes: [new ObjectId(user2._id)],
          likesCount: 1,
          comments: [
            {
              _id: new ObjectId(),
              author: new ObjectId(user2._id),
              content: 'Chào bạn! Chúc mừng bài viết đầu tiên!',
              createdAt: new Date(),
              likes: [],
              likesCount: 0
            }
          ],
          commentsCount: 1,
          shares: [],
          sharesCount: 0,
          media: [],
          tags: ['cow', 'social', 'firstpost'],
          location: null,
          isEdited: false,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          author: new ObjectId(user2._id),
          content: 'Hôm nay thời tiết đẹp quá! Ai đi chơi cùng không? 🌞',
          type: 'text',
          visibility: 'public',
          likes: [new ObjectId(user1._id), new ObjectId(user3._id)],
          likesCount: 2,
          comments: [],
          commentsCount: 0,
          shares: [],
          sharesCount: 0,
          media: [
            {
              type: 'image',
              url: 'https://placehold.co/600x400/87CEEB/FFFFFF?text=Beautiful+Day',
              caption: 'Thời tiết đẹp'
            }
          ],
          tags: ['weather', 'hangout'],
          location: {
            name: 'Hà Nội, Việt Nam',
            latitude: 21.0285,
            longitude: 105.8542
          },
          isEdited: false,
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
        },
        {
          author: new ObjectId(user3._id),
          content: 'Chia sẻ một bài hát hay: "Shape of You" - Ed Sheeran 🎵',
          type: 'media',
          visibility: 'friends',
          likes: [],
          likesCount: 0,
          comments: [
            {
              _id: new ObjectId(),
              author: new ObjectId(user1._id),
              content: 'Bài này hay lắm!',
              createdAt: new Date(),
              likes: [new ObjectId(user3._id)],
              likesCount: 1
            }
          ],
          commentsCount: 1,
          shares: [],
          sharesCount: 0,
          media: [
            {
              type: 'audio',
              url: 'https://example.com/audio/shape-of-you.mp3',
              caption: 'Shape of You - Ed Sheeran',
              duration: 240
            }
          ],
          tags: ['music', 'edsheeran'],
          location: null,
          isEdited: false,
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
          updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      ];
      
      // Xóa posts cũ và tạo mới
      await db.collection('posts').deleteMany({});
      const result = await db.collection('posts').insertMany(samplePosts);
      console.log(`✅ Created ${result.insertedCount} sample posts`);
      
      // Tạo indexes cho posts
      await db.collection('posts').createIndex({ author: 1, createdAt: -1 });
      await db.collection('posts').createIndex({ visibility: 1 });
      await db.collection('posts').createIndex({ tags: 1 });
      await db.collection('posts').createIndex({ createdAt: -1 });
      console.log('✅ Created posts indexes');
      
      console.log('\n=== Sample posts ===');
      const posts = await db.collection('posts').find({}).limit(2).toArray();
      
      posts.forEach((post, index) => {
        console.log(`Post ${index + 1}:`, {
          _id: post._id,
          author: post.author,
          content: post.content.substring(0, 50) + '...',
          type: post.type,
          visibility: post.visibility,
          likesCount: post.likesCount,
          commentsCount: post.commentsCount,
          tags: post.tags,
          createdAt: post.createdAt
        });
      });
    }
    
    // Tạo thêm activities collection để track user activities
    console.log('\n=== Creating activities collection ===');
    const sampleActivities = [
      {
        user: new ObjectId(users[0]._id),
        type: 'post_created',
        description: 'Đã tạo bài viết mới',
        data: {
          postId: new ObjectId()
        },
        createdAt: new Date()
      },
      {
        user: new ObjectId(users[1]._id),
        type: 'friend_added',
        description: 'Đã kết bạn với người dùng mới',
        data: {
          friendId: new ObjectId(users[0]._id)
        },
        createdAt: new Date()
      }
    ];
    
    await db.collection('activities').deleteMany({});
    const activityResult = await db.collection('activities').insertMany(sampleActivities);
    console.log(`✅ Created ${activityResult.insertedCount} sample activities`);
    
    // Tạo indexes cho activities
    await db.collection('activities').createIndex({ user: 1, createdAt: -1 });
    await db.collection('activities').createIndex({ type: 1 });
    console.log('✅ Created activities indexes');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

createPostsStructure();
