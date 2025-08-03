// Test email với sender mới: noreply@cow.com
const axios = require('axios');

const testEmailWithNewSender = async () => {
  try {
    console.log('🧪 Testing Email với sender mới...');
    console.log('📧 From: noreply@cow.com (via Gmail SMTP)');  
    console.log('📧 To: hohuong15052005@gmail.com');
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
    
    if (response.data.success && response.data.emailSent) {
      console.log('🎉 Email sent successfully!');
      console.log('📧 Password reset email đã được gửi');
      console.log('📨 Sender sẽ hiển thị: "Cow Social Network <noreply@cow.com>"');
      console.log('📨 Recipient: hohuong15052005@gmail.com');
      
      const currentTime = new Date();
      console.log('🕐 Thời gian gửi:', currentTime.toLocaleString('vi-VN'));
      console.log('');
      console.log('🔍 Kiểm tra email hohuong15052005@gmail.com:');
      console.log('   ✅ Subject: "🔒 Yêu cầu đặt lại mật khẩu - Cow Social Network"');
      console.log('   ✅ From: "Cow Social Network <noreply@cow.com>"');  
      console.log('   ✅ Button: "🔑 Đặt lại mật khẩu"');
      console.log('   ⏰ Hiệu lực: 5 phút');
    } else {
      console.log('❌ Email sending failed or email not sent');
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

console.log('🚀 Testing Email với Sender mới');
console.log('🔧 EMAIL_FROM: noreply@cow.com');
console.log('🔧 EMAIL_USER: nghiaht28102003@gmail.com (SMTP auth)');  
console.log('🔧 Display name: "Cow Social Network"');
console.log('===============================================');

testEmailWithNewSender().then(() => {
  console.log('\n🏁 Test completed!');
  console.log('📧 Check email để xác nhận sender đã đổi thành noreply@cow.com');
  console.log('💡 Email sẽ hiển thị từ "Cow Social Network" thay vì Gmail cá nhân');
  process.exit(0);
});
