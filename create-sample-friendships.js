const { MongoClient, ObjectId } = require('mongodb');

async function createSampleFriendships() {
    const client = new MongoClient('mongodb://localhost:27017');
    try {
        await client.connect();
        const db = client.db('cow_social_network');
        
        // Get all users
        const users = await db.collection('users').find({}).toArray();
        console.log('Found users:', users.length);
        
        if (users.length >= 2) {
            const user1 = users[0]; // admin@cow.com
            const user2 = users[1]; // nghiaht281003@gmail.com
            const user3 = users[2]; // nếu có user thứ 3
            
            console.log('User 1:', user1.email, user1._id);
            console.log('User 2:', user2.email, user2._id);
            if (user3) console.log('User 3:', user3.email, user3._id);
            
            // Tạo friendship giữa user1 và user2
            const friendship1 = {
                requester: new ObjectId(user2._id),
                recipient: new ObjectId(user1._id),
                status: 'accepted',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            await db.collection('friendships').insertOne(friendship1);
            console.log('Created friendship between', user2.email, 'and', user1.email);
            
            // Nếu có user3, tạo thêm friendship
            if (user3) {
                const friendship2 = {
                    requester: new ObjectId(user2._id),
                    recipient: new ObjectId(user3._id),
                    status: 'accepted',
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                
                await db.collection('friendships').insertOne(friendship2);
                console.log('Created friendship between', user2.email, 'and', user3.email);
            }
            
            console.log('\n=== Created friendships ===');
            const friendships = await db.collection('friendships').find({}).toArray();
            friendships.forEach((friendship, index) => {
                console.log(`Friendship ${index + 1}:`, {
                    requester: friendship.requester,
                    recipient: friendship.recipient,
                    status: friendship.status
                });
            });
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

createSampleFriendships();
