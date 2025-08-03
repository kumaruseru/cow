// Test email configuration script
require('dotenv').config();
const emailService = require('./services/emailService');

async function testEmailConfiguration() {
  console.log('🧪 Testing Email Configuration...\n');
  
  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
  console.log(`   EMAIL_USER: ${process.env.EMAIL_USER || 'undefined'}`);
  console.log(`   EMAIL_PASS: ${process.env.EMAIL_PASS ? '***configured***' : 'undefined'}`);
  console.log(`   SMTP_HOST: ${process.env.SMTP_HOST || 'undefined'}`);
  console.log(`   SMTP_PORT: ${process.env.SMTP_PORT || 'undefined'}\n`);
  
  // Test email sending
  const testEmail = process.env.EMAIL_USER || 'test@example.com';
  
  try {
    console.log('📧 Sending test password reset email...');
    const resetResult = await emailService.sendPasswordResetEmail(
      testEmail,
      'test-token-12345',
      'Test User'
    );
    
    if (resetResult.success) {
      console.log('✅ Password reset email sent successfully!');
      if (resetResult.previewUrl) {
        console.log(`🔗 Preview: ${resetResult.previewUrl}`);
      }
    } else {
      console.log('❌ Failed to send password reset email:');
      console.log(`   Error: ${resetResult.error}`);
    }
    
    console.log('\n📧 Sending test password change notification...');
    const changeResult = await emailService.sendPasswordChangeNotification(
      testEmail,
      'Test User'
    );
    
    if (changeResult.success) {
      console.log('✅ Password change notification sent successfully!');
      if (changeResult.previewUrl) {
        console.log(`🔗 Preview: ${changeResult.previewUrl}`);
      }
    } else {
      console.log('❌ Failed to send password change notification:');
      console.log(`   Error: ${changeResult.error}`);
    }
    
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
  }
  
  console.log('\n📝 Email Configuration Guide:');
  console.log('   1. Copy .env file and update email credentials');
  console.log('   2. For Gmail: Enable 2FA and generate App Password');
  console.log('   3. For other providers: Use your SMTP credentials');
  console.log('   4. Test with: node test-email-config.js');
}

testEmailConfiguration();
