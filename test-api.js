const https = require('https');
const http = require('http');

async function testLogin() {
    const loginData = JSON.stringify({
        email: 'john@example.com',
        password: '123456'
    });

    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(loginData)
        }
    };

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    resolve({ status: res.statusCode, data: response });
                } catch (error) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(loginData);
        req.end();
    });
}

async function testConversations(token) {
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/conversations',
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    resolve({ status: res.statusCode, data: response });
                } catch (error) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
}

async function runTests() {
    try {
        console.log('Testing login...');
        const loginResult = await testLogin();
        console.log('Login result:', loginResult);

        if (loginResult.status === 200 && loginResult.data.token) {
            console.log('\nTesting conversations...');
            const conversationsResult = await testConversations(loginResult.data.token);
            console.log('Conversations result:', conversationsResult);
        } else {
            console.log('Login failed, cannot test conversations');
        }
    } catch (error) {
        console.error('Test error:', error);
    }
}

runTests();
