const mongoose = require('mongoose');

// Production MongoDB Atlas Connection
const connectDB = async () => {
  try {
    // MongoDB Atlas connection string format:
    // mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
    
    const mongoURI = process.env.MONGODB_URI || 
      'mongodb+srv://cowuser:password@cow-cluster.mongodb.net/cow-production?retryWrites=true&w=majority';
    
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
      retryWrites: true,
      w: 'majority'
    };

    const conn = await mongoose.connect(mongoURI, options);
    
    console.log(`✅ MongoDB Atlas Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected');
    });
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('🔌 MongoDB connection closed through app termination');
      process.exit(0);
    });
    
    return conn;
  } catch (error) {
    console.error('❌ MongoDB Atlas connection failed:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
