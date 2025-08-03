const mongoose = require('mongoose');

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/cow_social_network');

async function migrateUsers() {
    try {
        // Wait a bit for connection
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');
        
        // Find users with password field but no passwordHash
        const usersToMigrate = await usersCollection.find({
            password: { $exists: true },
            passwordHash: { $exists: false }
        }).toArray();
        
        console.log(`Found ${usersToMigrate.length} users to migrate`);
        
        for (const user of usersToMigrate) {
            // Rename password field to passwordHash
            await usersCollection.updateOne(
                { _id: user._id },
                {
                    $rename: { password: 'passwordHash' }
                }
            );
            console.log(`Migrated user: ${user.email}`);
        }
        
        console.log('Migration completed!');
        
    } catch (error) {
        console.error('Migration error:', error);
    } finally {
        mongoose.connection.close();
    }
}

migrateUsers();
