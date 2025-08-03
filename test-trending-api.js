const mongoose = require('mongoose');
const Post = require('./models/Post');

async function testTrendingAPI() {
  try {
    await mongoose.connect('mongodb://localhost:27017/cow_social_network');
    console.log('📦 Connected to MongoDB');

    console.log('\n=== TESTING TRENDING API LOGIC ===\n');

    const currentTime = new Date();
    const sevenDaysAgo = new Date(currentTime - 7 * 24 * 60 * 60 * 1000);
    
    console.log('Current time:', currentTime.toISOString());
    console.log('Seven days ago:', sevenDaysAgo.toISOString());
    
    // Check all posts first
    const allPosts = await Post.find({}).select('content tags createdAt privacy isActive');
    console.log(`\n📊 Total posts in database: ${allPosts.length}`);
    
    allPosts.forEach((post, index) => {
      console.log(`Post ${index + 1}:`);
      console.log(`  Content: "${post.content.substring(0, 60)}..."`);
      console.log(`  Tags: [${post.tags.join(', ')}]`);
      console.log(`  Created: ${post.createdAt.toISOString()}`);
      console.log(`  Privacy: ${post.privacy}, Active: ${post.isActive}`);
      console.log('');
    });

    // Test the aggregation pipeline step by step
    console.log('\n=== STEP 1: Filter posts ===');
    const filteredPosts = await Post.find({
      privacy: 'public',
      isActive: true,
      createdAt: { $gte: sevenDaysAgo },
      tags: { $exists: true, $not: { $size: 0 } }
    }).select('content tags createdAt likes comments');
    
    console.log(`Posts matching filter: ${filteredPosts.length}`);
    filteredPosts.forEach((post, index) => {
      console.log(`  ${index + 1}. Tags: [${post.tags.join(', ')}] - Likes: ${post.likes.length}, Comments: ${post.comments.length}`);
    });

    console.log('\n=== STEP 2: Run aggregation ===');
    const trendingData = await Post.aggregate([
      {
        $match: {
          privacy: 'public',
          isActive: true,
          createdAt: { $gte: sevenDaysAgo },
          tags: { $exists: true, $not: { $size: 0 } }
        }
      },
      { $unwind: '$tags' },
      {
        $group: {
          _id: '$tags',
          count: { $sum: 1 },
          recentPosts: { $sum: { $cond: [{ $gte: ['$createdAt', new Date(currentTime - 24 * 60 * 60 * 1000)] }, 1, 0] } },
          totalLikes: { $sum: { $size: '$likes' } },
          totalComments: { $sum: { $size: '$comments' } }
        }
      },
      {
        $addFields: {
          engagement: { $add: ['$totalLikes', '$totalComments'] },
          trendScore: {
            $add: [
              { $multiply: ['$count', 1] },
              { $multiply: ['$recentPosts', 3] },
              { $multiply: ['$engagement', 0.5] }
            ]
          }
        }
      },
      { $sort: { trendScore: -1 } },
      { $limit: 10 }
    ]);

    console.log(`Aggregation result: ${trendingData.length} trending hashtags`);
    trendingData.forEach((item, index) => {
      console.log(`  ${index + 1}. #${item._id}: ${item.count} posts, ${item.recentPosts} recent, ${item.engagement} engagement, score: ${item.trendScore}`);
    });

    // Test final formatting
    console.log('\n=== STEP 3: Format trending data ===');
    const trending = trendingData.map(item => {
      const growthRate = item.recentPosts > 0 ? Math.min(((item.recentPosts / item.count) * 100), 99) : 0;
      let trend = 'TĂNG';
      let growth = `+${Math.round(growthRate)}%`;
      
      if (growthRate > 50 || item.engagement > 20) {
        trend = 'HOT';
        growth = `+${Math.round(growthRate)}%`;
      } else if (growthRate < 10) {
        trend = 'TĂNG';
        growth = `+${Math.round(Math.max(growthRate, 5))}%`;
      }

      return {
        hashtag: item._id,
        count: item.count,
        trend: trend,
        growth: growth,
        engagement: item.engagement,
        recentActivity: item.recentPosts
      };
    });

    console.log('Final trending data:');
    trending.forEach((item, index) => {
      console.log(`  ${index + 1}. #${item.hashtag}: ${item.count} bài viết - ${item.trend} ${item.growth}`);
    });

  } catch (error) {
    console.error('❌ Error testing trending API:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📦 Disconnected from MongoDB');
  }
}

testTrendingAPI();
