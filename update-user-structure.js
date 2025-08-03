const { MongoClient, ObjectId } = require('mongodb');

async function updateUserStructure() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('cow_social_network');
    
    console.log('=== Updating user structure based on Hồ Hương database ===');
    
    // Lấy tất cả users hiện tại
    const users = await db.collection('users').find({}).toArray();
    console.log(`Found ${users.length} users to update`);
    
    for (const user of users) {
      console.log(`\nUpdating user: ${user.email}`);
      
      // Tạo cấu trúc mới theo mẫu Hồ Hương
      const updateData = {
        // Thông tin cơ bản (giữ nguyên nếu có)
        firstName: user.firstName || 'User',
        lastName: user.lastName || 'Name',
        email: user.email,
        
        // Thêm các field mới theo mẫu Hồ Hương
        username: user.username || user.email.split('@')[0],
        role: user.role || 'user',
        verified: user.verified !== undefined ? user.verified : false,
        isOnline: user.isOnline !== undefined ? user.isOnline : false,
        private: user.private !== undefined ? user.private : false,
        
        // Thông tin profile
        profile: {
          firstName: user.firstName || 'User',
          lastName: user.lastName || 'Name',
          avatar: user.avatar || 'https://placehold.co/48x48/000000/FFFFFF?text=U',
          coverPhoto: user.coverPhoto || '',
          bio: user.bio || '',
          location: user.location || '',
          website: user.website || '',
          phone: user.phone || ''
        },
        
        // Thông tin ngày tháng
        birthDate: user.birthDate || new Date('2000-01-01'),
        gender: user.gender || 'male',
        joinDate: user.joinDate || user.createdAt || new Date(),
        lastActivity: user.lastActivity || new Date(),
        
        // Preferences và activity
        preferences: user.preferences || {},
        activity: user.activity || {},
        
        // Security settings
        twoFactorEnabled: user.twoFactorEnabled || false,
        loginAttempts: user.loginAttempts || 0,
        refreshTokens: user.refreshTokens || [],
        
        // Timestamps
        createdAt: user.createdAt || new Date(),
        updatedAt: new Date(),
        
        // Version control
        __v: user.__v || 0
      };
      
      // Giữ nguyên password nếu có
      if (user.password) {
        updateData.password = user.password;
      }
      
      // Giữ nguyên password reset fields nếu có
      if (user.passwordHash) updateData.passwordHash = user.passwordHash;
      if (user.passwordResetToken) updateData.passwordResetToken = user.passwordResetToken;
      if (user.passwordResetExpires) updateData.passwordResetExpires = user.passwordResetExpires;
      
      // Cập nhật user
      const result = await db.collection('users').updateOne(
        { _id: user._id },
        { $set: updateData }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`✅ Updated user: ${user.email}`);
      } else {
        console.log(`⚠️ No changes for user: ${user.email}`);
      }
    }
    
    console.log('\n=== Sample updated user ===');
    const sampleUser = await db.collection('users').findOne({ email: 'nghiaht281003@gmail.com' });
    if (sampleUser) {
      console.log(JSON.stringify({
        _id: sampleUser._id,
        username: sampleUser.username,
        email: sampleUser.email,
        firstName: sampleUser.firstName,
        lastName: sampleUser.lastName,
        verified: sampleUser.verified,
        role: sampleUser.role,
        profile: sampleUser.profile,
        joinDate: sampleUser.joinDate,
        lastActivity: sampleUser.lastActivity
      }, null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

updateUserStructure();
