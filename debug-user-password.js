const { MongoClient, ObjectId } = require('mongodb');

async function debugUserPassword() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('cow_social_network');
    
    console.log('=== Debug user password field ===');
    const user = await db.collection('users').findOne({ email: 'nghiaht281003@gmail.com' });
    
    if (user) {
      console.log('User found:');
      console.log('_id:', user._id);
      console.log('email:', user.email);
      console.log('password field exists:', 'password' in user);
      console.log('password value:', user.password);
      console.log('password type:', typeof user.password);
      console.log('password length:', user.password ? user.password.length : 'null/undefined');
      console.log('passwordHash field exists:', 'passwordHash' in user);
      console.log('passwordHash value:', user.passwordHash);
      
      // Show all fields containing 'password'
      console.log('\nAll password-related fields:');
      Object.keys(user).forEach(key => {
        if (key.toLowerCase().includes('password')) {
          console.log(`${key}:`, user[key]);
        }
      });
    } else {
      console.log('User not found!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

debugUserPassword();
