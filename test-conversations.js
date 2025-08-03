const http = require('http');

async function testConversations() {
    // Token từ John login
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODhlODVmMDc2NjdjNzZlNWYyYjViNTYiLCJlbWFpbCI6ImpvaG5AZXhhbXBsZS5jb20iLCJ1c2VybmFtZSI6ImpvaG4xNzEiLCJpYXQiOjE3NTQxNzA4NjQsImV4cCI6MTc1NDc3NTY2NH0.HtTMXVwTuVwo9KJnkdcxKrTjjtmtHBESdUMlq3Vx_cc';

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

async function sendMessage() {
    // John's token
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODhlODVmMDc2NjdjNzZlNWYyYjViNTYiLCJlbWFpbCI6ImpvaG5AZXhhbXBsZS5jb20iLCJ1c2VybmFtZSI6ImpvaG4xNzEiLCJpYXQiOjE3NTQxNzA4NjQsImV4cCI6MTc1NDc3NTY2NH0.HtTMXVwTuVwo9KJnkdcxKrTjjtmtHBESdUMlq3Vx_cc';
    // Jane's ID
    const janeId = '688e85f07667c76e5f2b5b5a';
    
    const messageData = JSON.stringify({
        recipientId: janeId,
        content: 'Hello Jane! This is a test message from John.'
    });

    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/messages',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(messageData)
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

        req.write(messageData);
        req.end();
    });
}

async function runTest() {
    try {
        console.log('Testing conversations API before sending message...');
        let result = await testConversations();
        console.log('Conversations result (before):', result);

        console.log('\nSending test message...');
        const messageResult = await sendMessage();
        console.log('Send message result:', messageResult);

        console.log('\nTesting conversations API after sending message...');
        result = await testConversations();
        console.log('Conversations result (after):', result);

    } catch (error) {
        console.error('Test error:', error);
    }
}

runTest();
