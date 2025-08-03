const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('./models/SimpleUser');

async function testTrendingWithAuth() {
  try {
    await mongoose.connect('mongodb://localhost:27017/cow_social_network');
    console.log('📦 Connected to MongoDB');

    // Get a user to create valid token
    const user = await User.findOne({});
    if (!user) {
      console.log('❌ No users found');
      return;
    }

    // Create a valid JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'cow-social-secret-key-2025',
      { expiresIn: '1h' }
    );

    console.log(`👤 Using user: ${user.email}`);
    console.log(`🔑 Token created: ${token.substring(0, 50)}...`);

    // Test the API with fetch
    const fetch = require('node-fetch');
    const response = await fetch('http://localhost:3000/api/posts/trending', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    console.log('\n📈 Trending API Response:');
    console.log(JSON.stringify(data, null, 2));

    if (data.success && data.trending) {
      console.log('\n🔥 Trending hashtags:');
      data.trending.forEach((item, index) => {
        console.log(`  ${index + 1}. #${item.hashtag}: ${item.count} bài viết - ${item.trend} ${item.growth}`);
      });
      console.log(`\n📊 Data source: ${data.dataSource}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n📦 Disconnected from MongoDB');
  }
}

// Install node-fetch if needed
try {
  require('node-fetch');
} catch (e) {
  console.log('Installing node-fetch...');
  require('child_process').execSync('npm install node-fetch@2', { stdio: 'inherit' });
}

testTrendingWithAuth();
