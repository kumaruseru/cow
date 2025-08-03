const mongoose = require('mongoose');
const User = require('./models/SimpleUser');
const Post = require('./models/Post');

async function addMoreRecentPosts() {
  try {
    await mongoose.connect('mongodb://localhost:27017/cow_social_network');
    console.log('📦 Connected to MongoDB');

    // Get existing users
    const users = await User.find({}).limit(5);
    if (users.length === 0) {
      console.log('❌ No users found');
      return;
    }

    console.log(`👤 Found ${users.length} users`);

    // Create more recent posts (today and yesterday)
    const now = new Date();
    const recentPosts = [
      {
        content: 'Hôm nay coding với #JavaScript và #ReactJS thật là vui! #CongNghe #WebDev',
        hoursAgo: 2 // 2 hours ago
      },
      {
        content: 'Đang học #TinTuc về AI mới nhất! #AI #MachineLearning #Tech #CongNghe',
        hoursAgo: 5 // 5 hours ago
      },
      {
        content: 'Cuối tuần đi #DuLich cùng bạn bè! #Travel #Weekend #GiaiTri #Summer',
        hoursAgo: 8 // 8 hours ago
      },
      {
        content: 'Thấy #CowSocialNetwork ngày càng tốt hơn! #Social #Networking #SinhVien',
        hoursAgo: 12 // 12 hours ago
      },
      {
        content: 'Ôn bài thi #SinhVien stress quá! #University #Study #Exams #HocTap',
        hoursAgo: 18 // 18 hours ago
      },
      {
        content: 'Netflix có phim mới hay! #GiaiTri #Movies #Entertainment #Netflix',
        hoursAgo: 20 // 20 hours ago
      },
      {
        content: 'Workshop #CongNghe hôm nay rất bổ ích! #Tech #Programming #Developer',
        hoursAgo: 1 // 1 hour ago - very recent
      },
      {
        content: 'Hot #TinTuc: Meta ra mắt AI mới! #AI #Tech #News #CongNghe',
        hoursAgo: 3 // 3 hours ago
      }
    ];

    let createdCount = 0;

    for (let i = 0; i < recentPosts.length; i++) {
      const postData = recentPosts[i];
      const randomUser = users[Math.floor(Math.random() * users.length)];
      
      // Create posts with recent timestamps
      const createdAt = new Date(now - (postData.hoursAgo * 60 * 60 * 1000));

      const post = new Post({
        content: postData.content,
        author: randomUser._id,
        privacy: 'public',
        createdAt: createdAt,
        updatedAt: createdAt
      });

      // Add some random likes and comments for engagement
      const likeCount = Math.floor(Math.random() * 15) + 5; // 5-19 likes
      for (let j = 0; j < likeCount; j++) {
        const randomLiker = users[Math.floor(Math.random() * users.length)];
        if (!post.likes.some(like => like.user.toString() === randomLiker._id.toString())) {
          post.likes.push({
            user: randomLiker._id,
            createdAt: new Date(createdAt.getTime() + Math.random() * 2 * 60 * 60 * 1000) // within 2 hours after post
          });
        }
      }

      // Add more comments for recent posts
      const commentCount = Math.floor(Math.random() * 8) + 2; // 2-9 comments
      const sampleComments = [
        'Đồng ý với bạn!',
        'Hay quá!',
        'Mình cũng nghĩ vậy!',
        'Thông tin bổ ích!',
        'Cảm ơn bạn đã chia sẻ!',
        'Tuyệt vời!',
        'Chính xác!',
        'Hay lắm!',
        'Mình cũng đang học cái này!',
        'Bạn có thể chia sẻ thêm không?'
      ];

      for (let k = 0; k < commentCount; k++) {
        const randomCommenter = users[Math.floor(Math.random() * users.length)];
        const randomComment = sampleComments[Math.floor(Math.random() * sampleComments.length)];
        
        post.comments.push({
          user: randomCommenter._id,
          content: randomComment,
          createdAt: new Date(createdAt.getTime() + Math.random() * 3 * 60 * 60 * 1000) // within 3 hours after post
        });
      }

      await post.save();
      createdCount++;
      console.log(`✅ Created recent post ${createdCount}: "${postData.content.substring(0, 60)}..." (${postData.hoursAgo}h ago)`);
    }

    console.log(`\n🎉 Successfully created ${createdCount} recent posts with high engagement!`);
    
    // Show updated stats
    const totalPosts = await Post.countDocuments({});
    const recentPostCount = await Post.countDocuments({
      createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) }
    });

    console.log(`📊 Stats:`);
    console.log(`   Total posts: ${totalPosts}`);
    console.log(`   Recent posts (24h): ${recentPostCount}`);

  } catch (error) {
    console.error('❌ Error creating recent posts:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📦 Disconnected from MongoDB');
  }
}

addMoreRecentPosts();
