const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

async function resetUserPassword() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('cow_social_network');
    
    console.log('=== Resetting password for nghiaht281003@gmail.com ===');
    
    // Hash password123 với bcrypt
    const password = 'password123';
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    console.log('New hashed password:', hashedPassword);
    
    // Cập nhật password
    const result = await db.collection('users').updateOne(
      { email: 'nghiaht281003@gmail.com' },
      { 
        $set: { 
          password: hashedPassword,
          passwordHash: hashedPassword, // Update cả 2 fields
          loginAttempts: 0, // Reset login attempts
          isLocked: false   // Unlock account
        },
        $unset: {
          lockedAt: ""      // Remove locked timestamp
        }
      }
    );
    
    console.log('Update result:', result);
    
    // Test password immediately
    console.log('\n=== Testing password immediately ===');
    const user = await db.collection('users').findOne({ email: 'nghiaht281003@gmail.com' });
    const isValid = await bcrypt.compare('password123', user.password);
    console.log('Password valid test:', isValid);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

resetUserPassword();
