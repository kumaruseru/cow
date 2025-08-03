const mongoose = require('mongoose');
const Post = require('./models/Post');

async function checkPosts() {
  try {
    await mongoose.connect('mongodb://localhost:27017/cow_social_network');
    console.log('📦 Connected to MongoDB');
    
    const posts = await Post.find({}).select('content tags createdAt');
    console.log(`📊 Total posts: ${posts.length}`);
    
    if (posts.length === 0) {
      console.log('❌ No posts found in database!');
      console.log('💡 Need to create posts with hashtags first.');
    } else {
      posts.forEach((post, index) => {
        console.log(`${index + 1}. "${post.content.substring(0, 50)}..."`);
        console.log(`   Tags: [${post.tags.join(', ')}]`);
        console.log(`   Created: ${post.createdAt}`);
        console.log('');
      });
    }
    
    await mongoose.disconnect();
    console.log('📦 Disconnected');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkPosts();
