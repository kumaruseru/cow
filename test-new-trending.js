const mongoose = require('mongoose');
const Post = require('./models/Post');

async function testNewTrending() {
  try {
    await mongoose.connect('mongodb://localhost:27017/cow_social_network');
    console.log('📦 Connected to MongoDB');

    console.log('\n=== TESTING NEW TRENDING LOGIC ===\n');

    const currentTime = new Date();
    const sevenDaysAgo = new Date(currentTime - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(currentTime - 24 * 60 * 60 * 1000);
    
    console.log('Current time:', currentTime.toISOString());
    console.log('24 hours ago:', oneDayAgo.toISOString());
    console.log('7 days ago:', sevenDaysAgo.toISOString());
    
    // Get all posts from last 7 days with tags
    const posts = await Post.find({
      privacy: 'public',
      isActive: true,
      createdAt: { $gte: sevenDaysAgo },
      tags: { $exists: true, $not: { $size: 0 } }
    }).select('tags createdAt likes comments');

    console.log(`\n📊 Found ${posts.length} posts with tags in last 7 days`);

    // Manual aggregation
    const tagStats = {};
    
    posts.forEach(post => {
      const isRecent = post.createdAt >= oneDayAgo;
      const likeCount = post.likes ? post.likes.length : 0;
      const commentCount = post.comments ? post.comments.length : 0;
      const engagement = likeCount + commentCount;
      
      console.log(`Post from ${post.createdAt.toISOString()}: ${post.tags.join(', ')} - ${likeCount} likes, ${commentCount} comments (${isRecent ? 'RECENT' : 'old'})`);
      
      post.tags.forEach(tag => {
        if (!tagStats[tag]) {
          tagStats[tag] = {
            count: 0,
            recentPosts: 0,
            totalLikes: 0,
            totalComments: 0,
            engagement: 0
          };
        }
        
        tagStats[tag].count++;
        if (isRecent) tagStats[tag].recentPosts++;
        tagStats[tag].totalLikes += likeCount;
        tagStats[tag].totalComments += commentCount;
        tagStats[tag].engagement += engagement;
      });
    });

    // Convert to array and calculate trend scores
    const trendingArray = Object.entries(tagStats).map(([tag, stats]) => {
      const trendScore = stats.count + (stats.recentPosts * 3) + (stats.engagement * 0.5);
      
      const growthRate = stats.recentPosts > 0 ? Math.min(((stats.recentPosts / stats.count) * 100), 99) : 0;
      let trend = 'TĂNG';
      let growth = `+${Math.round(Math.max(growthRate, 5))}%`;
      
      if (growthRate > 50 || stats.engagement > 10) {
        trend = 'HOT';
      }

      return {
        hashtag: tag,
        count: stats.count,
        trend: trend,
        growth: growth,
        engagement: stats.engagement,
        recentActivity: stats.recentPosts,
        trendScore: trendScore
      };
    });

    // Sort by trend score and take top 10
    const trending = trendingArray
      .sort((a, b) => b.trendScore - a.trendScore)
      .slice(0, 10);

    console.log(`\n🔥 Top ${trending.length} trending hashtags:\n`);
    trending.forEach((item, index) => {
      console.log(`${index + 1}. #${item.hashtag}`);
      console.log(`   📊 ${item.count} bài viết - ${item.trend} ${item.growth}`);
      console.log(`   💬 ${item.engagement} tương tác, ${item.recentActivity} bài gần đây`);
      console.log(`   📈 Trend score: ${item.trendScore.toFixed(1)}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📦 Disconnected from MongoDB');
  }
}

testNewTrending();
