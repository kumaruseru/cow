// Test login and get friends data
async function testMessages() {
    try {
        // Test login first
        console.log('=== Testing Login ===');
        const loginResponse = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'nghiaht281003@gmail.com', // Use existing email from database
                password: 'your_password_here' // You'll need to provide the correct password
            })
        });
        
        const loginData = await loginResponse.json();
        console.log('Login response:', loginData);
        
        if (loginData.success && loginData.accessToken) {
            const token = loginData.accessToken;
            console.log('Login successful! Token:', token.substring(0, 20) + '...');
            
            // Test friends API
            console.log('\n=== Testing Friends API ===');
            const friendsResponse = await fetch('http://localhost:3000/api/friends', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const friendsData = await friendsResponse.json();
            console.log('Friends response:', friendsData);
            
            if (friendsData.friends) {
                console.log('\n=== Friends Data Structure ===');
                friendsData.friends.forEach((friend, index) => {
                    console.log(`Friend ${index + 1}:`, {
                        id: friend.id,
                        _id: friend._id,
                        firstName: friend.firstName,
                        lastName: friend.lastName,
                        email: friend.email
                    });
                });
            }
        } else {
            console.error('Login failed:', loginData);
        }
        
    } catch (error) {
        console.error('Test error:', error);
    }
}

testMessages();
