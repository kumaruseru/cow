const mongoose = require('mongoose');
const User = require('./models/SimpleUser');
const Post = require('./models/Post');

async function createSamplePosts() {
  try {
    await mongoose.connect('mongodb://localhost:27017/cow_social_network');
    console.log('📦 Connected to MongoDB');

    // Get existing users
    const users = await User.find({}).limit(5);
    if (users.length === 0) {
      console.log('❌ No users found. Please create users first.');
      return;
    }

    console.log(`👤 Found ${users.length} users`);

    // Sample posts with hashtags
    const samplePosts = [
      {
        content: 'Chào mọi người! Mình vừa tham gia #CowSocialNetwork rồi đây! #SinhVien #CongNghe',
        privacy: 'public'
      },
      {
        content: 'Hôm nay học về React rất thú vị! #CongNghe #ReactJS #JavaScript #HocTap',
        privacy: 'public'
      },
      {
        content: 'Cuối tuần đi #DuLich Đà Lạt cùng bạn bè! #Travel #Weekend #GiaiTri',
        privacy: 'public'
      },
      {
        content: 'Tin #TinTuc mới nhất về công nghệ AI! #AI #MachineLearning #CongNghe #Tech',
        privacy: 'public'
      },
      {
        content: 'Cuộc sống #SinhVien thật là bận rộn nhưng vui vẻ! #University #HocTap #Life',
        privacy: 'public'
      },
      {
        content: 'Netflix và chill! 🍿 #GiaiTri #Movies #Netflix #ChillTime',
        privacy: 'public'
      },
      {
        content: 'Code review session hôm nay! #Programming #CongNghe #Developer #CodeReview',
        privacy: 'public'
      },
      {
        content: 'Học JavaScript ES6+ thật là thú vị! #JavaScript #ES6 #CongNghe #WebDev',
        privacy: 'public'
      },
      {
        content: 'Thảo luận về #TinTuc công nghệ blockchain! #Blockchain #Crypto #Tech',
        privacy: 'public' 
      },
      {
        content: 'Kế hoạch #DuLich hè 2024! Ai muốn đi cùng? #Summer #Travel #Vacation',
        privacy: 'public'
      },
      {
        content: 'Ôn thi cuối kỳ với #SinhVien gang! #Exams #Study #University #Stress',
        privacy: 'public'
      },
      {
        content: 'Xem phim mới trên Netflix! #GiaiTri #Movies #Entertainment #Weekend',
        privacy: 'public'
      },
      {
        content: '#CowSocialNetwork thật là tuyệt vời! Kết nối được nhiều bạn mới! #Social #Networking',
        privacy: 'public'
      },
      {
        content: 'Workshop về Python và Machine Learning! #Python #ML #CongNghe #Workshop',
        privacy: 'public'
      },
      {
        content: 'Tin #TinTuc hot: OpenAI ra mắt model mới! #AI #OpenAI #Tech #News',
        privacy: 'public'
      }
    ];

    // Delete existing posts to start fresh
    await Post.deleteMany({});
    console.log('🗑️ Cleared existing posts');

    let createdCount = 0;
    const now = new Date();

    for (let i = 0; i < samplePosts.length; i++) {
      const postData = samplePosts[i];
      const randomUser = users[Math.floor(Math.random() * users.length)];
      
      // Create posts with different timestamps (some recent, some older)
      const daysAgo = Math.floor(Math.random() * 10); // 0-9 days ago
      const hoursAgo = Math.floor(Math.random() * 24); // 0-23 hours ago
      const createdAt = new Date(now - (daysAgo * 24 * 60 * 60 * 1000) - (hoursAgo * 60 * 60 * 1000));

      const post = new Post({
        content: postData.content,
        author: randomUser._id,
        privacy: postData.privacy,
        createdAt: createdAt,
        updatedAt: createdAt
      });

      // Add some random likes and comments
      const likeCount = Math.floor(Math.random() * 8); // 0-7 likes
      for (let j = 0; j < likeCount; j++) {
        const randomLiker = users[Math.floor(Math.random() * users.length)];
        if (!post.likes.some(like => like.user.toString() === randomLiker._id.toString())) {
          post.likes.push({
            user: randomLiker._id,
            createdAt: new Date(createdAt.getTime() + Math.random() * 24 * 60 * 60 * 1000)
          });
        }
      }

      // Add some random comments
      const commentCount = Math.floor(Math.random() * 4); // 0-3 comments
      const sampleComments = [
        'Hay quá!',
        'Đồng ý với bạn!',
        'Thông tin bổ ích!',
        'Cảm ơn bạn đã chia sẻ!',
        'Mình cũng nghĩ vậy!',
        'Tuyệt vời!',
        'Hay lắm!'
      ];

      for (let k = 0; k < commentCount; k++) {
        const randomCommenter = users[Math.floor(Math.random() * users.length)];
        const randomComment = sampleComments[Math.floor(Math.random() * sampleComments.length)];
        
        post.comments.push({
          user: randomCommenter._id,
          content: randomComment,
          createdAt: new Date(createdAt.getTime() + Math.random() * 24 * 60 * 60 * 1000)
        });
      }

      await post.save();
      createdCount++;
      console.log(`✅ Created post ${createdCount}: "${postData.content.substring(0, 50)}..."`);
    }

    console.log(`\n🎉 Successfully created ${createdCount} sample posts with hashtags!`);
    
    // Show some stats
    const totalPosts = await Post.countDocuments({});
    const totalHashtags = await Post.aggregate([
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log(`📊 Stats:`);
    console.log(`   Total posts: ${totalPosts}`);
    console.log(`   Unique hashtags: ${totalHashtags.length}`);
    console.log(`   Top hashtags:`);
    totalHashtags.slice(0, 5).forEach((tag, index) => {
      console.log(`     ${index + 1}. #${tag._id}: ${tag.count} posts`);
    });

  } catch (error) {
    console.error('❌ Error creating sample posts:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📦 Disconnected from MongoDB');
  }
}

// Run the function
createSamplePosts();
