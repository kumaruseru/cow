const { MongoClient } = require('mongodb');

async function checkUserCredentials() {
    const client = new MongoClient('mongodb://localhost:27017');
    try {
        await client.connect();
        const db = client.db('cow_social_network');
        
        console.log('=== All users with email and password ===');
        const users = await db.collection('users').find({}).toArray();
        users.forEach((user, index) => {
            console.log(`User ${index + 1}:`, {
                _id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                hasPassword: !!user.password,
                passwordLength: user.password ? user.password.length : 0
            });
        });
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

checkUserCredentials();
