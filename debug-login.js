// Debug login/logout issue
const axios = require('axios');

const debugLoginFlow = async () => {
  try {
    console.log('🔍 DEBUG: Login Flow Analysis');
    console.log('============================');
    
    // Step 1: Register hoặc sử dụng user có sẵn
    console.log('\n📝 Step 1: Using existing user');
    const testEmail = 'hohuong15052005@gmail.com';
    const testPassword = 'password123'; // Thường dùng password này cho test
    
    console.log(`Email: ${testEmail}`);
    console.log(`Password: ${testPassword}`);
    
    // Step 2: Login
    console.log('\n🔐 Step 2: Attempting login...');
    
    const loginResponse = await axios.post(
      'http://localhost:3000/api/auth/login',
      {
        email: testEmail,
        password: testPassword
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Login Response:');
    console.log('Status:', loginResponse.status);
    console.log('Data:', loginResponse.data);
    
    if (loginResponse.data.token) {
      const token = loginResponse.data.token;
      console.log(`🔑 JWT Token received: ${token.substring(0, 50)}...`);
      
      // Step 3: Test protected route
      console.log('\n🛡️ Step 3: Testing protected route...');
      
      try {
        const protectedResponse = await axios.get(
          'http://localhost:3000/api/auth/me',
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        console.log('✅ Protected route response:');
        console.log('Status:', protectedResponse.status);
        console.log('Data:', protectedResponse.data);
        
        // Step 4: Test after some time
        console.log('\n⏰ Step 4: Testing token after 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const delayedResponse = await axios.get(
          'http://localhost:3000/api/auth/me',
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        console.log('✅ Delayed response:');
        console.log('Status:', delayedResponse.status);
        console.log('Data:', delayedResponse.data);
        
      } catch (protectedError) {
        console.log('❌ Protected route failed:');
        console.log('Status:', protectedError.response?.status);
        console.log('Data:', protectedError.response?.data);
        
        if (protectedError.response?.status === 403) {
          console.log('🚨 TOKEN EXPIRED OR INVALID!');
          console.log('This could be the logout issue.');
        }
      }
      
    } else {
      console.log('❌ No token received in login response');
    }
    
  } catch (error) {
    if (error.response) {
      console.log('❌ Login Error:');
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
      
      if (error.response.status === 401) {
        console.log('🚨 INVALID CREDENTIALS');
        console.log('User có thể không tồn tại hoặc password sai');
      }
    } else {
      console.log('❌ Network Error:', error.message);
    }
  }
};

console.log('🚀 Debugging Login/Logout Issue');
console.log('🎯 Mục tiêu: Tìm nguyên nhân tự động đăng xuất');
console.log('🔧 JWT_EXPIRE: 7d (from .env)');
console.log('🔧 JWT_SECRET: Configured');

debugLoginFlow().then(() => {
  console.log('\n🏁 Debug completed!');
  console.log('💡 Check kết quả để xác định vấn đề');
  process.exit(0);
});
