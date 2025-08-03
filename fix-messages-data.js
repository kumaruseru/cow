const { MongoClient, ObjectId } = require('mongodb');

async function fixMessagesData() {
    const client = new MongoClient('mongodb://localhost:27017');
    try {
        await client.connect();
        const db = client.db('cow_social_network');
        
        console.log('=== Checking and fixing messages collection ===');
        const messages = await db.collection('messages').find({}).toArray();
        console.log('Total messages:', messages.length);
        
        if (messages.length > 0) {
            for (let msg of messages) {
                let needsUpdate = false;
                let updateData = {};
                
                // Check senderId
                if (msg.senderId && typeof msg.senderId === 'string') {
                    console.log('Converting senderId from string to ObjectId:', msg.senderId);
                    updateData.sender = new ObjectId(msg.senderId);
                    needsUpdate = true;
                }
                
                // Check recipientId  
                if (msg.recipientId && typeof msg.recipientId === 'string') {
                    console.log('Converting recipientId from string to ObjectId:', msg.recipientId);
                    updateData.recipient = new ObjectId(msg.recipientId);
                    needsUpdate = true;
                }
                
                // Remove old fields if they exist
                if (msg.senderId || msg.recipientId) {
                    updateData.$unset = {};
                    if (msg.senderId) updateData.$unset.senderId = "";
                    if (msg.recipientId) updateData.$unset.recipientId = "";
                    needsUpdate = true;
                }
                
                if (needsUpdate) {
                    await db.collection('messages').updateOne(
                        { _id: msg._id }, 
                        updateData
                    );
                    console.log('Updated message:', msg._id);
                }
            }
        }
        
        console.log('\n=== Sample fixed messages ===');
        const fixedMessages = await db.collection('messages').find({}).limit(3).toArray();
        fixedMessages.forEach((msg, index) => {
            console.log(`Message ${index + 1}:`, {
                _id: msg._id,
                sender: msg.sender,
                recipient: msg.recipient,
                content: msg.content?.substring(0, 30) + '...',
                senderId: msg.senderId, // Should be undefined now
                recipientId: msg.recipientId // Should be undefined now
            });
        });
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

fixMessagesData();
