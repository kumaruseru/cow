const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const SimpleUser = require('./models/SimpleUser');

// Kết nối MongoDB
mongoose.connect('mongodb://localhost:27017/cow_social_network').then(async () => {
  console.log('📦 MongoDB connected for updating john credentials');
  
  try {
    // Tìm user john
    const john = await SimpleUser.findOne({ email: 'john@example.com' });
    
    if (!john) {
      console.log('❌ John user not found');
      return;
    }
    
    console.log('👤 Found John:', john.email);
    
    // Tạo password mới cho john: "password123"
    const plainPassword = 'password123';
    const hashedPassword = await bcrypt.hash(plainPassword, 12);
    
    // Cập nhật password
    john.passwordHash = hashedPassword;
    await john.save();
    
    console.log(`✅ Updated John's password to: ${plainPassword}`);
    console.log('🔑 Password hash:', hashedPassword.substring(0, 30) + '...');
    
    // Tương tự cho Jane
    const jane = await SimpleUser.findOne({ email: 'jane@example.com' });
    if (jane) {
      jane.passwordHash = hashedPassword; // Cùng password
      await jane.save();
      console.log(`✅ Updated Jane's password to: ${plainPassword}`);
    }
    
    // Alice và Bob nếu có
    const alice = await SimpleUser.findOne({ email: 'alice@example.com' });
    if (alice) {
      alice.passwordHash = hashedPassword;
      await alice.save();
      console.log(`✅ Updated Alice's password to: ${plainPassword}`);
    }
    
    const bob = await SimpleUser.findOne({ email: 'bob@example.com' });
    if (bob) {
      bob.passwordHash = hashedPassword;
      await bob.save();
      console.log(`✅ Updated Bob's password to: ${plainPassword}`);
    }
    
    console.log('\n🔓 Login credentials:');
    console.log('Email: john@example.com, Password: password123');
    console.log('Email: jane@example.com, Password: password123');
    console.log('Email: alice@example.com, Password: password123');
    console.log('Email: bob@example.com, Password: password123');
    
  } catch (error) {
    console.error('❌ Error updating credentials:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
});
