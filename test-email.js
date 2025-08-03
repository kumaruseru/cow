// Test Email Functionality
const axios = require('axios');

const testForgotPassword = async () => {
    try {
        console.log('🧪 Testing Forgot Password with Gmail App Password...');
        
        const response = await axios.post('http://localhost:3000/api/auth/forgot-password', {
            email: 'nghiaht28102003@gmail.com'
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Response:', response.data);
        console.log('📧 Email should be sent to: nghiaht28102003@gmail.com');
        console.log('🔍 Check your email inbox for password reset email!');
        
    } catch (error) {
        if (error.response) {
            console.log('❌ Error Response:', error.response.data);
            console.log('📊 Status:', error.response.status);
        } else {
            console.log('❌ Network Error:', error.message);
        }
    }
};

const testDifferentEmail = async () => {
    try {
        console.log('\n🧪 Testing with a different email (should create reset token but no email sent)...');
        
        const response = await axios.post('http://localhost:3000/api/auth/forgot-password', {
            email: 'test@example.com'
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Response:', response.data);
        
    } catch (error) {
        if (error.response) {
            console.log('❌ Error Response:', error.response.data);
            console.log('📊 Status:', error.response.status);
        } else {
            console.log('❌ Network Error:', error.message);
        }
    }
};

// Run tests
console.log('🚀 Starting Email Test Suite...');
console.log('📧 Gmail App Password Test');
console.log('📝 Using configured email: nghiaht28102003@gmail.com');
console.log('🔑 Using App Password: vzlhsybsptpvbmuz (from .env)');
console.log('───────────────────────────────────────────────────');

testForgotPassword()
    .then(() => testDifferentEmail())
    .then(() => {
        console.log('\n🎉 Test completed!');
        console.log('📧 If email was sent successfully, your Gmail App Password is working!');
        console.log('📨 Check your email: nghiaht28102003@gmail.com');
        process.exit(0);
    });
