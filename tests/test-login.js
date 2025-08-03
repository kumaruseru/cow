// Test login endpoint
const axios = require('axios');

async function testLogin() {
    try {
        const testData = {
            email: "test@example.com",
            password: "TestPassword123!"
        };

        console.log('🧪 Testing login endpoint...');
        console.log('📤 Sending data:', testData);

        const response = await axios.post('http://localhost:3000/api/auth/login', testData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Response status:', response.status);
        console.log('📋 Response data:', response.data);

    } catch (error) {
        console.error('❌ Error testing login:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Message:', error.message);
        }
    }
}

testLogin();
