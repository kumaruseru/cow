// Test forgot password functionality
const axios = require('axios');

async function testForgotPassword() {
    try {
        const testEmail = "test@example.com"; // Use existing user email
        
        console.log('🧪 Testing forgot password endpoint...');
        console.log('📤 Sending request for email:', testEmail);

        const response = await axios.post('http://localhost:3000/api/auth/forgot-password', {
            email: testEmail
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Response status:', response.status);
        console.log('📋 Response data:', response.data);

        if (response.data.resetUrl) {
            console.log('🔗 Reset URL:', response.data.resetUrl);
            
            // Extract token from URL for testing reset
            const urlParts = response.data.resetUrl.split('token=');
            if (urlParts.length > 1) {
                const token = urlParts[1];
                console.log('🔑 Extracted token:', token);
                
                // Test reset password
                await testResetPassword(token);
            }
        }

    } catch (error) {
        console.error('❌ Error testing forgot password:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Message:', error.message);
        }
    }
}

async function testResetPassword(token) {
    try {
        console.log('\n🔄 Testing reset password endpoint...');
        console.log('🔑 Using token:', token);

        const newPassword = "NewPassword123!";
        
        const response = await axios.post('http://localhost:3000/api/auth/reset-password', {
            token: token,
            password: newPassword
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Reset response status:', response.status);
        console.log('📋 Reset response data:', response.data);

    } catch (error) {
        console.error('❌ Error testing reset password:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Message:', error.message);
        }
    }
}

testForgotPassword();
