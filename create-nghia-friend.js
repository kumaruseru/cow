const mongoose = require('mongoose');
const User = require('./models/User');
const Friend = require('./models/Friend');

async function createFriendshipForNghia() {
    try {
        await mongoose.connect('mongodb://localhost:27017/cow_social_network');
        console.log('Connected to MongoDB');
        
        // Get Nghia and John
        const nghia = await User.findOne({email: 'nghiaht281003@gmail.com'});
        const john = await User.findOne({email: 'john@example.com'});
        
        if (!nghia || !john) {
            console.log('Users not found');
            process.exit(1);
        }
        
        console.log('Nghia ID:', nghia._id);
        console.log('John ID:', john._id);
        
        // Create friendship
        const friendship = new Friend({
            requester: nghia._id,
            recipient: john._id,
            status: 'accepted',
            createdAt: new Date()
        });
        
        await friendship.save();
        console.log('Friendship created between Nghia and John');
        
        process.exit();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

createFriendshipForNghia();
