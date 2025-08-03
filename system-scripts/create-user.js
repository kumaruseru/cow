const mongoose = require('mongoose');
require('dotenv').config();

// Import User model
const User = require('./models/User');

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

    // Create new user
    const newUser = await User.create(userData);
    console.log('✅ User created successfully:');
    console.log('   ID:', newUser._id);
    console.log('   Username:', newUser.username);
    console.log('   Email:', newUser.email);
    console.log('   Name:', newUser.profile.firstName, newUser.profile.lastName);
    console.log('   Birth Date:', newUser.birthDate);
    console.log('   Gender:', newUser.gender);
    console.log('   Role:', newUser.role);
    
  } catch (error) {
    console.error('❌ Error creating user:', error.message);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
};

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 6) {
  console.log('Usage: node create-user.js <firstName> <lastName> <email> <day> <month> <year> <gender> <password>');
  console.log('Example: node create-user.js "Nguyen" "Van A" "test@example.com" "15" "8" "1995" "male" "123456"');
  process.exit(1);
}

const [firstName, lastName, email, day, month, year, gender, password] = args;

// Validate input
if (!firstName || !lastName || !email || !day || !month || !year || !gender || !password) {
  console.error('❌ All fields are required');
  process.exit(1);
}

// Validate date
const dayNum = parseInt(day);
const monthNum = parseInt(month);
const yearNum = parseInt(year);

if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12 || yearNum < 1900 || yearNum > new Date().getFullYear()) {
  console.error('❌ Invalid date values');
  process.exit(1);
}

// Validate gender
if (!['male', 'female', 'other'].includes(gender)) {
  console.error('❌ Gender must be: male, female, or other');
  process.exit(1);
}

// Create username from firstName and lastName
const username = (firstName + lastName).toLowerCase().replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');

// Format birth date
const birthDate = new Date(yearNum, monthNum - 1, dayNum);

// User data object
const userData = {
  username,
  email,
  password,
  birthDate,
  gender,
  profile: {
    firstName,
    lastName
  },
  role: 'user',
  verified: false
};

console.log('🚀 Creating user with data:');
console.log('   Username:', username);
console.log('   Email:', email);
console.log('   Name:', firstName, lastName);
console.log('   Birth Date:', birthDate.toDateString());
console.log('   Gender:', gender);
console.log('');

// Create the user
createUser(userData);
