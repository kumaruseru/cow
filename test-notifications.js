const http = require('http');

async function testNotifications() {
    // Token từ John login - có thể cần update token mới
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODhlODVmMDc2NjdjNzZlNWYyYjViNTYiLCJlbWFpbCI6ImpvaG5AZXhhbXBsZS5jb20iLCJ1c2VybmFtZSI6ImpvaG4xNzEiLCJpYXQiOjE3NTQxNzA4NjQsImV4cCI6MTc1NDc3NTY2NH0.HtTMXVwTuVwo9KJnkdcxKrTjjtmtHBESdUMlq3Vx_cc';

    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/notifications',
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

async function testUnreadCount() {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODhlODVmMDc2NjdjNzZlNWYyYjViNTYiLCJlbWFpbCI6ImpvaG5AZXhhbXBsZS5jb20iLCJ1c2VybmFtZSI6ImpvaG4xNzEiLCJpYXQiOjE3NTQxNzA4NjQsImV4cCI6MTc1NDc3NTY2NH0.HtTMXVwTuVwo9KJnkdcxKrTjjtmtHBESdUMlq3Vx_cc';

    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/notifications/unread-count',
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

async function runTest() {
    try {
        console.log('Testing notifications API...');
        const notificationsResult = await testNotifications();
        console.log('Notifications result:', JSON.stringify(notificationsResult, null, 2));

        console.log('\nTesting unread count API...');
        const unreadCountResult = await testUnreadCount();
        console.log('Unread count result:', JSON.stringify(unreadCountResult, null, 2));

    } catch (error) {
        console.error('Test error:', error);
    }
}

runTest();
