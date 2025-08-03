// Temporary fix - Sử dụng Ethereal Email
// File này sẽ thay thế Gmail tạm thời

const nodemailer = require('nodemailer');

class EtherealEmailService {
  constructor() {
    this.transporter = null;
    this.testAccount = null;
  }

  async initialize() {
    console.log('📧 Initializing Ethereal Email Service (Temporary Fix)...');
    
    // Tạo test account
    this.testAccount = await nodemailer.createTestAccount();
    
    // Tạo transporter
    this.transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: this.testAccount.user,
        pass: this.testAccount.pass
      }
    });
    
    console.log('✅ Ethereal Email ready:');
    console.log('📧 User:', this.testAccount.user);
    console.log('🔗 All emails will be at: https://ethereal.email/');
  }

  async sendPasswordResetEmail(email, token, userName = 'User') {
    try {
      if (!this.transporter) {
        await this.initialize();
      }

      const resetUrl = `http://localhost:3000/reset-password?token=${token}`;
      
      const info = await this.transporter.sendMail({
        from: '"Cow Social Network" <noreply@cow.social>',
        to: email,
        subject: 'Đặt lại mật khẩu - Cow Social Network',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb;">🐄 Cow Social Network</h1>
            </div>
            
            <h2 style="color: #333;">🔐 Đặt lại mật khẩu</h2>
            
            <p>Xin chào <strong>${userName}</strong>,</p>
            
            <p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản Cow Social Network của mình.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background: #2563eb; color: white; padding: 15px 30px; 
                        text-decoration: none; border-radius: 8px; display: inline-block;
                        font-weight: bold; font-size: 16px;">
                🔑 Đặt lại mật khẩu
              </a>
            </div>
            
            <div style="background: #fef3c7; border: 1px solid #f59e0b; 
                        border-radius: 8px; padding: 15px; margin: 20px 0;">
              <strong>🛡️ Lưu ý bảo mật:</strong>
              <ul style="margin: 10px 0;">
                <li>Link này chỉ có hiệu lực trong <strong>5 phút</strong></li>
                <li>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này</li>
                <li>Không chia sẻ link này với bất kỳ ai</li>
              </ul>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              Nếu button không hoạt động, copy link sau vào trình duyệt:<br>
              <a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a>
            </p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            
            <p style="color: #999; font-size: 12px; text-align: center;">
              © 2025 Cow Social Network. Email này được gửi tự động.
            </p>
          </div>
        `
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      
      console.log('✅ Password reset email sent (Ethereal)');
      console.log('📧 Message ID:', info.messageId);
      console.log('🔗 Preview URL:', previewUrl);
      
      return {
        success: true,
        messageId: info.messageId,
        previewUrl: previewUrl
      };
      
    } catch (error) {
      console.log('❌ Ethereal email error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new EtherealEmailService();
