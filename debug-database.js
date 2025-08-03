const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/cow_social_network');

async function checkDatabase() {
    try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');
        
        const users = await usersCollection.find({}).toArray();
        console.log('All users in database:');
        users.forEach(user => {
            console.log(`- ID: ${user._id}`);
            console.log(`  Email: ${user.email}`);
            console.log(`  Username: ${user.username}`);
            console.log(`  FirstName: ${user.firstName}`);
            console.log(`  LastName: ${user.lastName}`);
            console.log(`  PasswordHash: ${user.passwordHash ? 'exists' : 'missing'}`);
            console.log(`  Password: ${user.password ? 'exists' : 'missing'}`);
            console.log('---');
        });
        
        // Test findOne query
        console.log('\nTesting findOne query:');
        const testUser = await usersCollection.findOne({
            $or: [
                { email: 'john@example.com' },
                { username: 'john@example.com' }
            ]
        });
        console.log('FindOne result:', testUser);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
}

checkDatabase();
