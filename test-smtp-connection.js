const nodemailer = require('nodemailer');

async function testSmtp() {
    console.log('Testing SMTP Connection...');
    const transporter = nodemailer.createTransport({
        host: 'mail.mazadclick.com',
        port: 587,
        secure: false,
        auth: {
            user: 'dev@mazadclick.com',
            pass: 'dev@mazadclick' 
        },
        tls: {
            rejectUnauthorized: false
        },
        connectionTimeout: 10000,
    });

    try {
        await transporter.verify();
        console.log('✅ SMTP Connection Successful!');
    } catch (error) {
        console.error('❌ SMTP Connection Failed:', error.message);
        if (error.code) console.error('Error Code:', error.code);
        if (error.command) console.error('Command:', error.command);
    }
}

testSmtp();
