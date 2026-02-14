
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
            }
        });
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
            await this.transporter.sendMail({
                from,
                to,
                subject,
                text,
                html,
            });
            this.logger.log(`Email sent successfully to ${to}`);
            return true;
        } catch (error) {
            this.logger.error(`Failed to send email to ${to}: ${error.message}`);
            return false;
        }
    }
}
