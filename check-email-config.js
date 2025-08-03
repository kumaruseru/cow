// Email Configuration Status Check
require('dotenv').config();

console.log('🔍 EMAIL CONFIGURATION STATUS REPORT');
console.log('=====================================\n');

// Check environment variables
const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;
const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT;

console.log('📋 Environment Variables:');
console.log(`   EMAIL_USER: ${emailUser || '❌ NOT SET'}`);
console.log(`   EMAIL_PASS: ${emailPass ? (emailPass === 'your_gmail_app_password_here' ? '⚠️  PLACEHOLDER - NEEDS REAL APP PASSWORD' : '✅ CONFIGURED') : '❌ NOT SET'}`);
console.log(`   SMTP_HOST: ${smtpHost || '❌ NOT SET'}`);
console.log(`   SMTP_PORT: ${smtpPort || '❌ NOT SET'}\n`);

// Determine email mode
const hasValidConfig = emailUser && emailPass && 
                      emailPass !== 'your_gmail_app_password_here' && 
                      emailPass !== 'your_app_password';

console.log('🎯 Current Email Mode:');
if (hasValidConfig) {
  console.log('   ✅ PRODUCTION MODE - Real emails will be sent');
  console.log(`   📧 Emails sent from: ${emailUser}`);
} else {
  console.log('   🧪 DEVELOPMENT MODE - Test emails only');
  console.log('   📧 Preview emails at: https://ethereal.email/messages');
}

console.log('\n📝 Next Steps:');
if (!hasValidConfig) {
  console.log('   1. 🔑 Get Gmail App Password:');
  console.log('      - Go to: https://myaccount.google.com/apppasswords');
  console.log('      - Enable 2FA first if not enabled');
  console.log('      - Generate App Password for "Mail"');
  console.log('   2. 📝 Update .env file:');
  console.log('      - Replace EMAIL_PASS value with your App Password');
  console.log('   3. 🧪 Test configuration:');
  console.log('      - Run: node test-email-config.js');
  console.log('   4. 🚀 Restart server to apply changes');
} else {
  console.log('   ✅ Configuration looks good!');
  console.log('   🧪 Test with: node test-email-config.js');
}

console.log('\n💡 Tips:');
console.log('   - App Password is 16 characters (remove spaces)');
console.log('   - Different from your Gmail login password');
console.log('   - Only works with 2FA enabled');
console.log('   - Keep it secret and secure');
