// Test với Ethereal Email (fake SMTP) để debug
const nodemailer = require('nodemailer');

const testEtherealEmail = async () => {
  console.log('🧪 Testing với Ethereal Email (Development SMTP)...');
  
  try {
    // Tạo test account với Ethereal
    const testAccount = await nodemailer.createTestAccount();
    console.log('✅ Ethereal test account created:');
    console.log('📧 User:', testAccount.user);
    console.log('🔑 Pass:', testAccount.pass);
    
    // Tạo transporter với Ethereal
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    
    // Gửi test email
    const info = await transporter.sendMail({
      from: '"Cow Social Network" <noreply@cow.social>',
      to: 'nghiaht28102003@gmail.com',
      subject: 'Đặt lại mật khẩu - Cow Social Network',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>🔐 Đặt lại mật khẩu</h2>
          <p>Xin chào TestUser,</p>
          <p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản Cow Social Network.</p>
          <a href="http://localhost:3000/reset-password?token=test-token" 
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Đặt lại mật khẩu
          </a>
          <p><strong>Lưu ý:</strong> Link này chỉ có hiệu lực trong 5 phút.</p>
        </div>
      `
    });
    
    console.log('✅ Email sent successfully!');
    console.log('📧 Message ID:', info.messageId);
    console.log('🔗 Preview URL:', nodemailer.getTestMessageUrl(info));
    console.log('');
    console.log('🎯 Click link trên để xem email preview!');
    
  } catch (error) {
    console.log('❌ Ethereal test failed:', error.message);
  }
};

console.log('🚀 Testing Ethereal Email Service...');
console.log('📝 Đây là test để debug email service');
console.log('=====================================');

testEtherealEmail().then(() => {
  console.log('\n🏁 Ethereal test completed!');
  console.log('💡 Nếu Ethereal hoạt động → Vấn đề là Gmail App Password');
  console.log('💡 Nếu Ethereal cũng lỗi → Vấn đề là cấu hình nodemailer');
  process.exit(0);
});
