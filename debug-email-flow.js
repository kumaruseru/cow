// Debug: Kiểm tra logic gửi email reset password
const axios = require('axios');

const debugPasswordResetFlow = async () => {
  try {
    console.log('🔍 DEBUG: Password Reset Email Flow');
    console.log('=====================================');
    
    // Test 1: Email tồn tại trong database (sẽ gửi email thật)
    console.log('\n📧 Test 1: Email có thể tồn tại trong DB');
    console.log('Email: hohuong15052005@gmail.com');
    console.log('Expected: Gửi email đến hohuong15052005@gmail.com');
    
    const response1 = await axios.post(
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
    
    console.log('✅ Response 1:', response1.data);
    
    // Test 2: Email chắc chắn không tồn tại (không gửi email)
    console.log('\n📧 Test 2: Email chắc chắn không tồn tại');
    console.log('Email: nonexistent@example.com');
    console.log('Expected: Không gửi email, chỉ trả response generic');
    
    const response2 = await axios.post(
      'http://localhost:3000/api/auth/forgot-password',
      {
        email: 'nonexistent@example.com'
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Response 2:', response2.data);
    
    // Test 3: Email của bạn (nghiaht28102003@gmail.com)
    console.log('\n📧 Test 3: Email chính của hệ thống');
    console.log('Email: nghiaht28102003@gmail.com');
    console.log('Expected: Gửi email đến nghiaht28102003@gmail.com');
    
    const response3 = await axios.post(
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
    
    console.log('✅ Response 3:', response3.data);
    
    console.log('\n🔍 PHÂN TÍCH KẾT QUẢ:');
    console.log('─────────────────────────');
    console.log('• emailSent: true = Email được gửi thành công');
    console.log('• emailSent: false = Email không được gửi (user không tồn tại)');
    console.log('• Địa chỉ nhận email = Chính xác email trong request');
    console.log('• From address = noreply@cow.com (đã fix)');
    
  } catch (error) {
    if (error.response) {
      console.log('❌ Error Response:', error.response.data);
      console.log('📊 Status Code:', error.response.status);
    } else {
      console.log('❌ Network Error:', error.message);
    }
  }
};

console.log('🚀 Debugging Password Reset Email Logic');
console.log('🎯 Mục tiêu: Xác minh email được gửi đến đúng địa chỉ yêu cầu');
console.log('📧 From: noreply@cow.com (sender)');
console.log('📧 SMTP: nghiaht28102003@gmail.com (authentication only)');

debugPasswordResetFlow().then(() => {
  console.log('\n🏁 Debug completed!');
  console.log('💡 Check terminal logs và email inbox để xác nhận');
  process.exit(0);
});
