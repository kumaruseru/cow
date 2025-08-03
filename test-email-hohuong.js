// Test gửi email đến hohuong15052005@gmail.com
const axios = require('axios');

const testEmailToHoHuong = async () => {
  try {
    console.log('🧪 Testing Password Reset Email...');
    console.log('📧 Target: hohuong15052005@gmail.com');
    console.log('⏰ Token hiệu lực: 5 phút');
    console.log('─────────────────────────────────────');

    const response = await axios.post(
      'http://localhost:3000/api/auth/forgot-password',
      {
        email: 'hohuong15052005@gmail.com'
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ API Response:', response.data);
    
    if (response.data.success) {
      console.log('🎉 Email request processed successfully!');
      console.log('📧 Password reset email đã được gửi đến: hohuong15052005@gmail.com');
      console.log('📨 Hãy check inbox của hohuong15052005@gmail.com');
      console.log('⏰ Link reset sẽ hết hạn sau 5 phút!');
      
      const currentTime = new Date();
      const expireTime = new Date(currentTime.getTime() + 5 * 60 * 1000);
      
      console.log('🕐 Thời gian gửi:', currentTime.toLocaleString('vi-VN'));
      console.log('⏰ Link hết hạn lúc:', expireTime.toLocaleString('vi-VN'));
    } else {
      console.log('❌ Email sending failed');
    }
    
  } catch (error) {
    if (error.response) {
      console.log('❌ Error Response:', error.response.data);
      console.log('📊 Status Code:', error.response.status);
    } else {
      console.log('❌ Network Error:', error.message);
    }
  }
};

console.log('🚀 Sending Password Reset Email');
console.log('📧 From: nghiaht28102003@gmail.com (via Gmail SMTP)');
console.log('📧 To: hohuong15052005@gmail.com');
console.log('🔑 Using Gmail App Password: wevtcytiisquhwwp');
console.log('===============================================');

testEmailToHoHuong().then(() => {
  console.log('\n🏁 Email test completed!');
  console.log('📨 Check email: hohuong15052005@gmail.com');
  console.log('📝 Subject: "Đặt lại mật khẩu - Cow Social Network"');
  console.log('🔗 Email sẽ chứa button "Đặt lại mật khẩu"');
  console.log('⚠️  Link chỉ có hiệu lực 5 phút!');
  process.exit(0);
});
