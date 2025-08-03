const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/cow_social_network').then(async () => {
  console.log('Connected to MongoDB');
  
  const users = await mongoose.connection.db.collection('users').find().toArray();
  console.log('Total users:', users.length);
  
  users.forEach((u, i) => {
    console.log(`${i+1}. ${u.email} - username: ${u.username || 'MISSING'} - passwordHash: ${!!u.passwordHash}`);
  });
  
  mongoose.connection.close();
}).catch(err => {
  console.error('Error:', err);
});
