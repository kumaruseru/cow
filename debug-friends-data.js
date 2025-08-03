const { MongoClient } = require('mongodb');

async function debugFriendsData() {
    const client = new MongoClient('mongodb://localhost:27017');
    try {
        await client.connect();
        const db = client.db('cow_social_network');
        
        console.log('=== Checking users collection ===');
        const users = await db.collection('users').find({}).limit(3).toArray();
        console.log('Sample users:');
        users.forEach((user, index) => {
            console.log(`User ${index + 1}:`, {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email
            });
        });
        
        console.log('\n=== Checking friends collection ===');
        const friends = await db.collection('friends').find({}).limit(5).toArray();
        console.log('Friends count:', friends.length);
        if (friends.length > 0) {
            console.log('Sample friends:');
            friends.forEach((friend, index) => {
                console.log(`Friend ${index + 1}:`, friend);
            });
        } else {
            console.log('No friends relationships found');
        }
        
        console.log('\n=== Checking messages collection ===');
        const messages = await db.collection('messages').find({}).limit(3).toArray();
        console.log('Messages count:', messages.length);
        if (messages.length > 0) {
            console.log('Sample messages:');
            messages.forEach((msg, index) => {
                console.log(`Message ${index + 1}:`, {
                    _id: msg._id,
                    senderId: msg.senderId,
                    recipientId: msg.recipientId,
                    content: msg.content?.substring(0, 50) + '...',
                    createdAt: msg.createdAt
                });
            });
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

debugFriendsData();
