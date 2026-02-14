import * as https from 'https';

console.log('🌐 Testing connectivity to github.com...');

const options = {
    hostname: 'github.com',
    port: 443,
    path: '/',
    method: 'HEAD',
    timeout: 5000
};

const req = https.request(options, (res) => {
    console.log(`✅ Connected to github.com. Status Code: ${res.statusCode}`);
});

req.on('error', (e) => {
    console.error(`❌ Connection failed: ${e.message}`);
});

req.on('timeout', () => {
    req.destroy();
    console.error('❌ Connection timed out');
});

req.end();
