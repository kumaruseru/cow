const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');

async function addPasswordsToUsers() {
    const client = new MongoClient('mongodb://localhost:27017');
    try {
        await client.connect();
        const db = client.db('cow_social_network');
        
        console.log('=== Adding passwords to main users ===');
        
        // Password mặc định
        const defaultPassword = 'password123';
        const hashedPassword = await bcrypt.hash(defaultPassword, 12);
        
        // Cập nhật password cho các user chính
        const mainUsers = [
            'nghiaht281003@gmail.com',
            '33nghia2003@gmail.com', 
            'admin@cow.com'
        ];
        
        for (const email of mainUsers) {
            const result = await db.collection('users').updateOne(
                { email: email },
                { $set: { password: hashedPassword } }
            );
            
            if (result.modifiedCount > 0) {
                console.log(`✅ Updated password for: ${email}`);
            } else {
                console.log(`❌ Failed to update password for: ${email}`);
            }
        }
        
        console.log(`\n📝 All passwords set to: ${defaultPassword}`);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

addPasswordsToUsers();
