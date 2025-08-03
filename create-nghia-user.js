const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcrypt');

async function createTestUser() {
    try {
        await mongoose.connect('mongodb://localhost:27017/cow_social_network');
        console.log('Connected to MongoDB');
        
        // Check if user exists
        const existingUser = await User.findOne({email: 'nghiaht281003@gmail.com'});
        if (existingUser) {
            console.log('User already exists');
            process.exit();
        }
        
        // Create user
        const hashedPassword = await bcrypt.hash('password123', 12);
        const user = new User({
            firstName: 'Nghia',
            lastName: 'Hoang',
            email: 'nghiaht281003@gmail.com',
            password: hashedPassword,
            birthDate: new Date('2003-10-28'),
            gender: 'male',
            verified: true,
            active: true
        });
        
        await user.save();
        console.log('User created:', user.email, user._id);
        
        process.exit();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

createTestUser();
