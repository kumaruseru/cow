const { MongoClient } = require('mongodb');

async function testAPIStructure() {
    const client = new MongoClient('mongodb://localhost:27017');
    try {
        await client.connect();
        const db = client.db('cow_social_network');
        
        console.log('=== Sample user data ===');
        const users = await db.collection('users').find({}).limit(2).toArray();
        users.forEach((user, index) => {
            console.log(`User ${index + 1}:`, {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email
            });
        });
        
        console.log('\n=== Sample friendship data ===');
        const friendships = await db.collection('friendships').find({}).limit(2).toArray();
        friendships.forEach((friendship, index) => {
            console.log(`Friendship ${index + 1}:`, {
                _id: friendship._id,
                requester: friendship.requester,
                recipient: friendship.recipient,
                status: friendship.status
            });
        });
        
        console.log('\n=== Sample message data ===');
        const messages = await db.collection('messages').find({}).limit(2).toArray();
        messages.forEach((msg, index) => {
            console.log(`Message ${index + 1}:`, {
                _id: msg._id,
                sender: msg.sender,
                recipient: msg.recipient,
                content: msg.content?.substring(0, 20) + '...'
            });
        });
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

testAPIStructure();
