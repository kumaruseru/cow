const nodemailer = require('nodemailer');
const logger = require('./logger');

const sendEmail = async options => {
  try {
    // Create reusable transporter object using the default SMTP transport
    const transporter = nodemailer.createTransporter({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Define email options
    const mailOptions = {
      from: `"Cow Social Network" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: options.email,
      subject: options.subject,
      text: options.message,
      html: options.html || options.message.replace(/\n/g, '<br>')
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    logger.info(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error('Email sending failed:', error.message);
    throw new Error('Email could not be sent');
  }
};

// Email templates
const emailTemplates = {
  welcome: (username, verificationUrl) => ({
    subject: 'Welcome to Cow Social Network!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Cow Social Network</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4f46e5; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🐄 Welcome to Cow Social Network!</h1>
          </div>
          <div class="content">
            <h2>Hello ${username}!</h2>
            <p>Thank you for joining Cow Social Network. We're excited to have you as part of our community!</p>
            <p>To get started, please verify your email address by clicking the button below:</p>
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
            <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #4f46e5;">${verificationUrl}</p>
            <p><strong>This link will expire in 24 hours.</strong></p>
            <p>If you didn't create this account, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© 2025 Cow Social Network. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  passwordReset: (username, resetUrl) => ({
    subject: 'Password Reset Request - Cow Social Network',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Request</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .warning { background: #fef3c7; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f59e0b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hello ${username}!</h2>
            <p>You are receiving this email because you (or someone else) has requested the reset of your password.</p>
            <p>To reset your password, please click the button below:</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #dc2626;">${resetUrl}</p>
            <div class="warning">
              <strong>⚠️ Important:</strong> This link will expire in 10 minutes for security reasons.
            </div>
            <p>If you did not request this password reset, please ignore this email and your password will remain unchanged.</p>
            <p>For security reasons, please do not share this link with anyone.</p>
          </div>
          <div class="footer">
            <p>© 2025 Cow Social Network. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  passwordChanged: username => ({
    subject: 'Password Changed Successfully - Cow Social Network',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Changed</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .security-notice { background: #dbeafe; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #3b82f6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Password Changed Successfully</h1>
          </div>
          <div class="content">
            <h2>Hello ${username}!</h2>
            <p>This email confirms that your password has been successfully changed.</p>
            <div class="security-notice">
              <strong>🔒 Security Notice:</strong> If you did not make this change, please contact our support team immediately.
            </div>
            <p>For your security, we recommend:</p>
            <ul>
              <li>Keep your password confidential</li>
              <li>Use a strong, unique password</li>
              <li>Enable two-factor authentication</li>
              <li>Log out from shared devices</li>
            </ul>
            <p>Thank you for keeping your account secure!</p>
          </div>
          <div class="footer">
            <p>© 2025 Cow Social Network. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  emailVerified: username => ({
    subject: 'Email Verified Successfully - Cow Social Network',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verified</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Email Verified Successfully!</h1>
          </div>
          <div class="content">
            <h2>Hello ${username}!</h2>
            <p>Congratulations! Your email address has been successfully verified.</p>
            <p>You can now enjoy all the features of Cow Social Network:</p>
            <ul>
              <li>Create and share posts</li>
              <li>Connect with friends</li>
              <li>Join conversations</li>
              <li>Customize your profile</li>
              <li>And much more!</li>
            </ul>
            <p>Welcome to the community! 🐄</p>
          </div>
          <div class="footer">
            <p>© 2025 Cow Social Network. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  })
};

// Send templated email
const sendTemplatedEmail = async (email, templateName, data) => {
  try {
    const template = emailTemplates[templateName];
    if (!template) {
      throw new Error(`Email template '${templateName}' not found`);
    }

    const emailContent = template(data.username, data.url);

    await sendEmail({
      email,
      subject: emailContent.subject,
      html: emailContent.html
    });
  } catch (error) {
    logger.error(`Templated email sending failed for template '${templateName}':`, error.message);
    throw error;
  }
};

module.exports = sendEmail;
module.exports.sendTemplatedEmail = sendTemplatedEmail;
module.exports.emailTemplates = emailTemplates;
