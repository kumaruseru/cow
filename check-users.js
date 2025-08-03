const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/cow_social_network');

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    firstName: String,
    lastName: String,
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    avatar: String,
    lastActivity: { type: Date, default: Date.now },
    isOnline: { type: Boolean, default: false },
    bio: String,
    location: String,
    website: String,
    joinDate: { type: Date, default: Date.now },
    verified: { type: Boolean, default: false },
    private: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema);

async function checkUsers() {
    try {
        const users = await User.find({});
        console.log('Found users:');
        for (const user of users) {
            console.log(`- ${user.email} (${user.firstName} ${user.lastName})`);
            
            // Test password
            const isPasswordValid = await bcrypt.compare('123456', user.passwordHash);
            console.log(`  Password '123456' valid: ${isPasswordValid}`);
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
}

checkUsers();
