const http = require('http');

async function registerUser(userData) {
    const postData = JSON.stringify(userData);

    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/register',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
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

        req.write(postData);
        req.end();
    });
}

async function testLogin(email, password) {
    const loginData = JSON.stringify({ email, password });

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

async function runTest() {
    try {
        console.log('Creating test users...');
        
        // Register John
        const johnResult = await registerUser({
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            password: '123456',
            birthDate: '1990-01-01',
            gender: 'male'
        });
        console.log('John registration:', johnResult);

        // Register Jane  
        const janeResult = await registerUser({
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@example.com',
            password: '123456',
            birthDate: '1992-05-15',
            gender: 'female'
        });
        console.log('Jane registration:', janeResult);

        // Test login with John
        console.log('\nTesting login...');
        const loginResult = await testLogin('john@example.com', '123456');
        console.log('Login result:', loginResult);

    } catch (error) {
        console.error('Test error:', error);
    }
}

runTest();
