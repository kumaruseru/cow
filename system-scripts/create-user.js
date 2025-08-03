const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Import User model
const User = require('../models/SimpleUser');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cow', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Create user function
const createUser = async (userData) => {
  try {
    await connectDB();
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      console.log('❌ User already exists with this email:', userData.email);
      return;
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(userData.password, saltRounds);
    
    // Create user data with proper schema
    const userToCreate = {
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
      passwordHash: passwordHash,
      bio: `Hello, I'm ${userData.firstName}!`,
      verified: false
    };

    // Create new user
    const newUser = await User.create(userToCreate);
    console.log('✅ User created successfully:');
    console.log('   ID:', newUser._id);
    console.log('   Email:', newUser.email);
    console.log('   Name:', newUser.firstName, newUser.lastName);
    console.log('   Join Date:', newUser.joinDate);
    console.log('   Verified:', newUser.verified);
    
  } catch (error) {
    console.error('❌ Error creating user:', error.message);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
};

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 4) {
  console.log('Usage: node create-user.js <firstName> <lastName> <email> <password>');
  console.log('Example: node create-user.js "Test" "User" "test@example.com" "123456"');
  process.exit(1);
}

const [firstName, lastName, email, password] = args;

// Validate input
if (!firstName || !lastName || !email || !password) {
  console.error('❌ All fields are required');
  process.exit(1);
}

// User data object
const userData = {
  firstName,
  lastName,
  email,
  password
};

console.log('🚀 Creating user with data:');
console.log('   Email:', email);
console.log('   Name:', firstName, lastName);
console.log('');

// Create the user
createUser(userData);
