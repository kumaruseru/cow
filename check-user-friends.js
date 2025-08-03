const mongoose = require('mongoose');
const User = require('./models/User');
const Friend = require('./models/Friend');

async function checkUserFriends() {
    try {
        await mongoose.connect('mongodb://localhost:27017/cow_social_network');
        
        const user = await User.findOne({email: 'nghiaht281003@gmail.com'});
        console.log('User ID:', user._id);
        
        const friends = await Friend.find({
            $or: [
                {requester: user._id, status: 'accepted'}, 
                {recipient: user._id, status: 'accepted'}
            ]
        });
        
        console.log('Friends count:', friends.length);
        friends.forEach(f => console.log('Friend:', f.requester, '->', f.recipient, 'status:', f.status));
        
        process.exit();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkUserFriends();
