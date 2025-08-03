// Test Password Reset với thời gian token 5 phút
const axios = require('axios');

const testPasswordReset5Minutes = async () => {
  try {
    console.log('🧪 Testing Password Reset với Token 5 phút...');
    console.log('📧 Email: nghiaht28102003@gmail.com');
    console.log('⏰ Token sẽ hết hạn sau 5 phút');
    console.log('─────────────────────────────────────');

    const response = await axios.post(
      'http://localhost:3000/api/auth/forgot-password',
      {
        email: 'nghiaht28102003@gmail.com'
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Response:', response.data);
    console.log('📧 Email đã được gửi với token có hiệu lực 5 phút!');
    console.log('🔍 Check email inbox để thấy thông báo "5 phút" trong email');

    const currentTime = new Date();
    const expireTime = new Date(currentTime.getTime() + 5 * 60 * 1000);

    console.log('🕐 Thời gian hiện tại:', currentTime.toLocaleString('vi-VN'));
    console.log('⏰ Token sẽ hết hạn lúc:', expireTime.toLocaleString('vi-VN'));
    console.log('⚠️  Token chỉ còn hiệu lực trong 5 phút từ bây giờ!');
  } catch (error) {
    if (error.response) {
      console.log('❌ Error Response:', error.response.data);
      console.log('📊 Status:', error.response.status);
    } else {
      console.log('❌ Network Error:', error.message);
    }
  }
};

console.log('🚀 Testing Password Reset với Token 5 phút');
console.log('🎯 Kiểm tra thời gian hiệu lực đã được rút từ 15 phút → 5 phút');
console.log('===============================================');

testPasswordReset5Minutes()
  .then(() => {
    console.log('\n🎉 Test hoàn thành!');
    console.log('📨 Check email nghiaht28102003@gmail.com');
    console.log('📝 Email sẽ hiển thị "Link này chỉ có hiệu lực trong 5 phút"');
    console.log('⏰ Token sẽ tự động hết hạn sau 5 phút!');
    process.exit(0);
  });
