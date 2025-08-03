// Test API endpoints directly
const { default: fetch } = require('node-fetch');

async function testAPI() {
    try {
        // Test login first
        console.log('=== Testing login ===');
        const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'nghiaht281003@gmail.com',
                password: 'password123'
            })
        });
        
        const loginData = await loginResponse.json();
        console.log('Login response:', loginData);
        
        if (loginData.success && loginData.token) {
            const token = loginData.token;
            
            // Test friends API
            console.log('\n=== Testing friends API ===');
            const friendsResponse = await fetch('http://localhost:3000/api/friends', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const friendsData = await friendsResponse.json();
            console.log('Friends response:', JSON.stringify(friendsData, null, 2));
            
            // Test messages API with a friend's ID
            if (friendsData.success && friendsData.friends.length > 0) {
                const friendId = friendsData.friends[0].id;
                console.log(`\n=== Testing messages API with friendId: ${friendId} ===`);
                
                const messagesResponse = await fetch(`http://localhost:3000/api/messages/${friendId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                const messagesData = await messagesResponse.json();
                console.log('Messages response:', JSON.stringify(messagesData, null, 2));
            }
        }
        
    } catch (error) {
        console.error('Error testing API:', error);
    }
}

testAPI();
