const fetch = require('node-fetch');

async function testLogin() {
    try {
        console.log('🧪 Testing login flow...\n');
        
        // Test 1: Login API
        console.log('1. Testing login API...');
        const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: 'hohuong15052005@gmail.com',
                password: '123456'
            })
        });
        
        console.log(`Login response status: ${loginResponse.status}`);
        const loginData = await loginResponse.json();
        console.log('Login response data:', JSON.stringify(loginData, null, 2));
        
        if (!loginData.success) {
            console.log('❌ Login failed');
            return;
        }
        
        const token = loginData.token;
        console.log(`✅ Login successful, token: ${token.substring(0, 50)}...\n`);
        
        // Test 2: Test API with token
        console.log('2. Testing API call with token...');
        const postsResponse = await fetch('http://localhost:3000/api/posts', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log(`Posts API response status: ${postsResponse.status}`);
        
        if (postsResponse.ok) {
            const posts = await postsResponse.json();
            console.log(`✅ API call successful, received ${posts.length} posts`);
        } else {
            const errorData = await postsResponse.json();
            console.log('❌ API call failed:', errorData);
        }
        
        // Test 3: Decode token
        console.log('\n3. Decoding token...');
        const jwt = require('jsonwebtoken');
        try {
            const decoded = jwt.decode(token);
            console.log('Token payload:', JSON.stringify(decoded, null, 2));
            
            // Verify token
            const verified = jwt.verify(token, process.env.JWT_SECRET || 'cow-social-secret-key-2025');
            console.log('✅ Token verification successful');
        } catch (err) {
            console.log('❌ Token verification failed:', err.message);
        }
        
    } catch (error) {
        console.error('❌ Test error:', error.message);
    }
}

testLogin();
