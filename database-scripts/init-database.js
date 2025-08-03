const mongoose = require('mongoose');

// MongoDB Atlas connection for initialization
const MONGODB_URI = 'mongodb+srv://cowuser:YOUR_PASSWORD@cow.xxxxx.mongodb.net/cow-production?retryWrites=true&w=majority';

async function initializeDatabase() {
  try {
    console.log('🔄 Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to MongoDB Atlas');
    console.log(`📊 Database: ${mongoose.connection.name}`);
    
    // Import models to ensure they're registered
    require('./src/models/User');
    require('./models/Friend');
    require('./src/models/Post');
    
    console.log('📋 Models registered successfully');
    
    // Create indexes for better performance
    console.log('🔧 Creating database indexes...');
    
    const User = mongoose.model('User');
    const Friend = mongoose.model('Friend');
    const Post = mongoose.model('Post');
    
    // User indexes
    await User.collection.createIndex({ email: 1 }, { unique: true });
    await User.collection.createIndex({ username: 1 }, { unique: true });
    await User.collection.createIndex({ firstName: 1, lastName: 1 });
    
    // Friend indexes
    await Friend.collection.createIndex({ requester: 1, recipient: 1 }, { unique: true });
    await Friend.collection.createIndex({ recipient: 1, status: 1 });
    await Friend.collection.createIndex({ requester: 1, status: 1 });
    
    // Post indexes
    await Post.collection.createIndex({ author: 1, createdAt: -1 });
    await Post.collection.createIndex({ isActive: 1, createdAt: -1 });
    
    console.log('✅ Database indexes created successfully');
    
    // Create default admin user (optional)
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      console.log('👤 Creating default admin user...');
      const bcrypt = require('bcryptjs');
      
      const adminUser = new User({
        username: 'admin',
        email: 'admin@cown.name.vn',
        password: await bcrypt.hash('admin123456', 12),
        firstName: 'Admin',
        lastName: 'User',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'other',
        isVerified: true,
        role: 'admin'
      });
      
      await adminUser.save();
      console.log('✅ Admin user created');
    }
    
    console.log('🎉 Database initialization completed successfully!');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database connection closed');
  }
}

// Run initialization
initializeDatabase();
