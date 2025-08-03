// Debug Email Sending Issue
const emailService = require('./services/emailService.js');

const debugEmailSending = async () => {
  console.log('🔍 DEBUG: Email Service');
  console.log('========================');
  
  try {
    // Test basic connection
    console.log('1. Testing SMTP connection...');
    
    // Try to send a simple test email
    console.log('2. Attempting to send password reset email...');
    
    const result = await emailService.sendPasswordResetEmail(
      'nghiaht28102003@gmail.com',
      'test-token-123',
      'TestUser'
    );
    
    console.log('✅ Email sending result:', result);
    
    if (result.success) {
      console.log('🎉 Email sent successfully!');
      console.log('📧 Email ID:', result.messageId);
      console.log('📨 Check your inbox: nghiaht28102003@gmail.com');
    } else {
      console.log('❌ Email sending failed!');
      console.log('🔍 Error details:', result.error);
    }
    
  } catch (error) {
    console.log('❌ Debug Error:', error.message);
    console.log('📊 Stack:', error.stack);
  }
};

console.log('🚀 Starting Email Debug Session...');
console.log('📧 Target: nghiaht28102003@gmail.com');
console.log('🔑 Using Gmail App Password: vzlhsybsptpvbmuz');

debugEmailSending().then(() => {
  console.log('\n🏁 Debug session completed!');
  process.exit(0);
});
