const nodemailer = require('nodemailer');
require('dotenv').config();

// Email service for sending password reset emails
class EmailService {
  constructor() {
    this.transporter = null;
    this.setupTransporter();
  }

  setupTransporter() {
    // Check if production email config is available
    const hasEmailConfig = process.env.EMAIL_USER && process.env.EMAIL_PASS && 
                           process.env.EMAIL_PASS !== 'your_gmail_app_password_here' &&
                           process.env.EMAIL_PASS !== 'your_app_password';
    
    if (hasEmailConfig) {
      // Production or configured email
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_USER || process.env.SMTP_USER,
          pass: process.env.EMAIL_PASS || process.env.SMTP_PASS
        }
      });

      console.log('📧 Email service configured with real SMTP:');
      console.log(`   Host: ${process.env.SMTP_HOST || 'smtp.gmail.com'}`);
      console.log(`   User: ${process.env.EMAIL_USER || process.env.SMTP_USER}`);
      console.log('   ✅ Ready to send real emails!');
      
    } else {
      // Development: Create test account with Ethereal Email
      console.log('⚠️  No valid email config found, using test email service');
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS === 'your_gmail_app_password_here') {
        console.log('💡 Please update EMAIL_PASS in .env with your Gmail App Password');
        console.log('📋 Run: setup-gmail.bat for detailed instructions');
      }
      this.createTestAccount();
    }
  }

  async createTestAccount() {
    try {
      // Generate test SMTP service account from ethereal.email
      const testAccount = await nodemailer.createTestAccount();
      
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });

      console.log('📧 Email service initialized with test account:');
      console.log(`   User: ${testAccount.user}`);
      console.log(`   Pass: ${testAccount.pass}`);
      console.log('   Preview emails at: https://ethereal.email/messages');
      
    } catch (error) {
      console.error('❌ Failed to create test email account:', error.message);
      
      // Fallback to manual configuration
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: 'ethereal.user@ethereal.email',
          pass: 'ethereal.pass'
        }
      });
    }
  }

  async sendPasswordResetEmail(email, resetToken, userName = 'Người dùng') {
    try {
      const resetUrl = `http://localhost:3000/reset-password?token=${resetToken}`;
      
      const mailOptions = {
        from: `"Cow Social Network" <${process.env.EMAIL_FROM || 'noreply@cow.com'}>`,
        to: email,
        subject: '🔒 Yêu cầu đặt lại mật khẩu - Cow Social Network',
        html: this.generateResetEmailTemplate(userName, resetUrl, email)
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('✅ Password reset email sent successfully:');
      console.log(`   To: ${email}`);
      console.log(`   Message ID: ${info.messageId}`);
      
      // For development, show preview URL
      if (process.env.NODE_ENV !== 'production') {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          console.log(`   Preview: ${previewUrl}`);
        }
      }

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: process.env.NODE_ENV !== 'production' ? nodemailer.getTestMessageUrl(info) : null
      };

    } catch (error) {
      console.error('❌ Failed to send password reset email:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  generateResetEmailTemplate(userName, resetUrl, email) {
    return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Đặt lại mật khẩu - Cow Social Network</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .email-container {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 15px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        .header {
          background: rgba(255,255,255,0.1);
          padding: 30px;
          text-align: center;
          color: white;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 300;
        }
        .content {
          background: white;
          padding: 40px 30px;
        }
        .welcome {
          font-size: 18px;
          margin-bottom: 20px;
          color: #333;
        }
        .message {
          font-size: 16px;
          margin-bottom: 30px;
          line-height: 1.8;
        }
        .reset-button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-decoration: none;
          padding: 15px 30px;
          border-radius: 50px;
          font-weight: bold;
          font-size: 16px;
          margin: 20px 0;
          transition: all 0.3s ease;
        }
        .reset-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        .security-notice {
          background: #f8f9fa;
          border-left: 4px solid #667eea;
          padding: 20px;
          margin: 30px 0;
          border-radius: 5px;
        }
        .footer {
          text-align: center;
          color: #666;
          font-size: 14px;
          margin-top: 30px;
          padding-top: 30px;
          border-top: 1px solid #eee;
        }
        .cow-emoji {
          font-size: 24px;
          margin: 0 10px;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <h1>🐄 Cow Social Network</h1>
          <p>Cộng đồng kết nối bạn bè</p>
        </div>
        
        <div class="content">
          <div class="welcome">
            Xin chào <strong>${userName}</strong>! 👋
          </div>
          
          <div class="message">
            Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn tại <strong>Cow Social Network</strong>.
            <br><br>
            Để đảm bảo bảo mật, vui lòng click vào nút bên dưới để tạo mật khẩu mới:
          </div>
          
          <div style="text-align: center;">
            <a href="${resetUrl}" class="reset-button">
              🔐 Đặt lại mật khẩu
            </a>
          </div>
          
          <div class="security-notice">
            <strong>🛡️ Lưu ý bảo mật:</strong>
            <ul>
              <li>Link này chỉ có hiệu lực trong <strong>5 phút</strong></li>
              <li>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này</li>
              <li>Không chia sẻ link này với bất kỳ ai</li>
            </ul>
          </div>
          
          <div style="margin-top: 30px; font-size: 14px; color: #666;">
            <strong>Không thể click vào nút?</strong> Copy và paste link này vào trình duyệt:
            <br>
            <div style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 5px; margin-top: 10px;">
              ${resetUrl}
            </div>
          </div>
          
          <div class="footer">
            <div class="cow-emoji">🐄</div>
            <p>
              Email này được gửi từ <strong>Cow Social Network</strong><br>
              Tài khoản: ${email}<br>
              Nếu bạn cần hỗ trợ, vui lòng liên hệ với chúng tôi
            </p>
            <p style="font-size: 12px; color: #999;">
              © 2025 Cow Social Network. Tất cả quyền được bảo lưu.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  async sendPasswordChangeNotification(email, userName = 'Người dùng') {
    try {
      const mailOptions = {
        from: `"Cow Social Network" <${process.env.EMAIL_FROM || 'noreply@cow.com'}>`,
        to: email,
        subject: '✅ Mật khẩu đã được thay đổi thành công - Cow Social Network',
        html: this.generatePasswordChangedTemplate(userName, email)
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('✅ Password change notification sent successfully:');
      console.log(`   To: ${email}`);
      console.log(`   Message ID: ${info.messageId}`);
      
      // For development, show preview URL
      if (process.env.NODE_ENV !== 'production') {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          console.log(`   Preview: ${previewUrl}`);
        }
      }

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: process.env.NODE_ENV !== 'production' ? nodemailer.getTestMessageUrl(info) : null
      };

    } catch (error) {
      console.error('❌ Failed to send password change notification:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  generatePasswordChangedTemplate(userName, email) {
    return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Mật khẩu đã được thay đổi - Cow Social Network</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .email-container {
          background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
          border-radius: 15px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        .header {
          background: rgba(255,255,255,0.1);
          padding: 30px;
          text-align: center;
          color: white;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 300;
        }
        .content {
          background: white;
          padding: 40px 30px;
        }
        .success-icon {
          text-align: center;
          font-size: 48px;
          margin-bottom: 20px;
        }
        .message {
          font-size: 16px;
          margin-bottom: 30px;
          line-height: 1.8;
          text-align: center;
        }
        .security-notice {
          background: #e8f5e8;
          border-left: 4px solid #11998e;
          padding: 20px;
          margin: 30px 0;
          border-radius: 5px;
        }
        .footer {
          text-align: center;
          color: #666;
          font-size: 14px;
          margin-top: 30px;
          padding-top: 30px;
          border-top: 1px solid #eee;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <h1>🐄 Cow Social Network</h1>
          <p>Thông báo bảo mật</p>
        </div>
        
        <div class="content">
          <div class="success-icon">✅</div>
          
          <div class="message">
            <strong>Xin chào ${userName}!</strong>
            <br><br>
            Mật khẩu của bạn đã được thay đổi thành công vào lúc <strong>${new Date().toLocaleString('vi-VN')}</strong>.
            <br><br>
            Tài khoản của bạn hiện đã được bảo mật với mật khẩu mới.
          </div>
          
          <div class="security-notice">
            <strong>🛡️ Lưu ý bảo mật:</strong>
            <ul>
              <li>Nếu bạn không thực hiện thay đổi này, vui lòng liên hệ với chúng tôi ngay lập tức</li>
              <li>Đảm bảo giữ mật khẩu mới an toàn</li>
              <li>Không chia sẻ mật khẩu với bất kỳ ai</li>
              <li>Tài khoản đã được mở khóa nếu trước đó bị khóa</li>
            </ul>
          </div>
          
          <div class="footer">
            <div style="font-size: 24px; margin: 0 10px;">🐄</div>
            <p>
              Email này được gửi từ <strong>Cow Social Network</strong><br>
              Tài khoản: ${email}<br>
              Thời gian: ${new Date().toLocaleString('vi-VN')}
            </p>
            <p style="font-size: 12px; color: #999;">
              © 2025 Cow Social Network. Tất cả quyền được bảo lưu.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
    `;
  }
}

module.exports = new EmailService();
