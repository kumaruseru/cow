// Test registration endpoint
const axios = require('axios');

async function testRegister() {
    try {
        const testData = {
            firstName: "Test",
            lastName: "User", 
            email: "test@example.com",
            password: "TestPassword123!",
            birthDate: "1990-01-01",
            gender: "male",
            profile: {
                firstName: "Test",
                lastName: "User"
            }
        };

        console.log('🧪 Testing registration endpoint...');
        console.log('📤 Sending data:', testData);

        const response = await axios.post('http://localhost:3000/api/auth/register', testData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Response status:', response.status);
        console.log('📋 Response data:', response.data);

    } catch (error) {
        console.error('❌ Error testing registration:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Message:', error.message);
        }
    }
}

testRegister();
