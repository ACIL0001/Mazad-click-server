import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function timeout(ms: number) {
    return new Promise((_, reject) => setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms));
}

async function testSmtp() {
    console.log('📧 Testing SMTP Configuration...');

    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;
    const from = process.env.SMTP_FROM || '"MazadClick Test" <no-reply@mazadclick.com>';

    console.log(`
    Configuration:
    Host: ${host}
    Port: ${port}
    User: ${user}
    From: ${from}
    Password: ${pass ? '******' : '(missing)'}
    `);

    if (!host || !user || !pass) {
        console.error('❌ Missing SMTP configuration in .env');
        return;
    }

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for other ports
        auth: {
            user,
            pass,
        },
        tls: {
            rejectUnauthorized: false // Allow self-signed certificates
        },
        connectionTimeout: 10000,
        socketTimeout: 10000,
        debug: true, // Enable debug output
        logger: true // Enable logger
    });

    try {
        console.log('🔄 Verifying SMTP connection...');
        await Promise.race([
            transporter.verify(),
            timeout(10000)
        ]);
        console.log('✅ SMTP Connection Verified Successfully!');

        // Try sending a test email
        console.log('🔄 Attempting to send test email...');
        const info = await transporter.sendMail({
            from,
            to: 'acil3967@gmail.com', // User provided test email
            subject: 'MazadClick SMTP Test',
            text: 'If you receive this, the SMTP configuration is working correctly.',
            html: '<b>If you receive this, the SMTP configuration is working correctly.</b>',
        });

        console.log('✅ Test email sent successfully!');
        console.log('Message ID:', info.messageId);
        console.log('Response:', info.response);

    } catch (error) {
        console.error('❌ SMTP Test Failed:', error);
        if (error.code === 'ESOCKET') {
            console.error('👉 Possible firewall or network issue blocking the port.');
        } else if (error.code === 'EAUTH') {
            console.error('👉 Authentication failed. Check username and password.');
        }
    }
}

testSmtp();
