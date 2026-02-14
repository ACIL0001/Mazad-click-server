
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
    private transporter: nodemailer.Transporter;
    private readonly logger = new Logger(EmailService.name);

    constructor(private readonly configService: ConfigService) {
        this.initializeTransporter();
    }

    private initializeTransporter() {
        const host = this.configService.get<string>('SMTP_HOST');
        const port = this.configService.get<number>('SMTP_PORT');
        const user = this.configService.get<string>('SMTP_USER');
        const password = this.configService.get<string>('SMTP_PASSWORD');

        if (!host || !user || !password) {
            this.logger.warn('SMTP configuration is missing. Email sending will be disabled or mocked in development.');
            return;
        }

        this.transporter = nodemailer.createTransport({
            host,
            port: port || 587,
            secure: port === 465, // true for 465, false for other ports
            auth: {
                user,
                pass: password,
            },
            tls: {
                rejectUnauthorized: false // Allow self-signed certificates
            },
            connectionTimeout: 15000, // 15 seconds
            socketTimeout: 15000, // 15 seconds
        });

        this.logger.log(`SMTP Transporter initialized: Host=${host}, Port=${port || 587}, User=${user}`);
    }

    async sendMail(to: string, subject: string, text: string, html?: string): Promise<boolean> {
        if (!this.transporter) {
            const forceRealEmail = process.env.ENABLE_REAL_EMAIL === 'true';

            if (process.env.NODE_ENV === 'development' && !forceRealEmail) {
                this.logger.log(`[MOCK EMAIL] To: ${to}, Subject: ${subject}, Text: ${text}`);
                return true;
            }
            this.logger.error('Transporter not initialized. Cannot send email. Check SMTP configuration.');
            return false;
        }

        try {
            const from = this.configService.get<string>('SMTP_FROM') || '"MazadClick" <no-reply@mazadclick.com>';

            // Create a timeout promise
            const timeoutPromise = new Promise<void>((_, reject) => {
                setTimeout(() => reject(new Error('Email sending timed out after 15 seconds')), 15000);
            });

            // Race between sending email and timeout
            await Promise.race([
                this.transporter.sendMail({
                    from,
                    to,
                    subject,
                    text,
                    html,
                }),
                timeoutPromise
            ]);

            this.logger.log(`Email sent successfully to ${to}`);
            return true;
        } catch (error) {
            this.logger.error(`Failed to send email to ${to}: ${error.message}`);
            if (error.code) this.logger.error(`SMTP Error Code: ${error.code}`);
            if (error.command) this.logger.error(`SMTP Failed Command: ${error.command}`);
            if (error.response) this.logger.error(`SMTP Response: ${error.response}`);

            // FALLBACK STRATEGY: Try Port 465 (SSL) if 587 (STARTTLS) timed out
            const currentPort = Number(this.configService.get('SMTP_PORT')) || 587;
            const isConnectionError = error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED' || error.code === 'ESOCKET' || error.command === 'CONN';

            if (isConnectionError && currentPort === 587) {
                this.logger.warn(`⚠️ Primary SMTP connection to port 587 failed (Code: ${error.code}). Attempting fallback to Port 465 (SSL)...`);

                try {
                    const fallbackTransporter = nodemailer.createTransport({
                        host: this.configService.get<string>('SMTP_HOST'),
                        port: 465,
                        secure: true, // Use SSL
                        auth: {
                            user: this.configService.get<string>('SMTP_USER'),
                            pass: this.configService.get<string>('SMTP_PASSWORD'),
                        },
                        tls: { rejectUnauthorized: false },
                        connectionTimeout: 10000,
                        socketTimeout: 10000,
                    });

                    await fallbackTransporter.sendMail({
                        from: this.configService.get<string>('SMTP_FROM') || '"MazadClick" <no-reply@mazadclick.com>',
                        to,
                        subject,
                        text,
                        html,
                    });

                    this.logger.log(`✅ Fallback email sent successfully to ${to} using Port 465`);
                    return true;
                } catch (fallbackError) {
                    this.logger.error(`❌ Fallback to Port 465 also failed: ${fallbackError.message}`);
                    return false;
                }
            }

            return false;
        }
    }
}
