// File: src/modules/otp/otp.module.ts (MERGED - Development Mode & Configuration)
import { Module } from '@nestjs/common';
import { OtpController } from './otp.controller';
import { OtpService } from './otp.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Otp, OtpSchema } from './schema/otp.schema';
import { SessionModule } from '../session/session.module';
import { UserModule } from '../user/user.module';
import { SmsService } from './sms.service';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    // MongoDB schemas
    MongooseModule.forFeature([{ name: Otp.name, schema: OtpSchema }]),

    // Other modules
    SessionModule,
    UserModule,

    // HTTP module for SMS service
    HttpModule.register({
      timeout: 15000, // 15 second timeout for HTTP requests
      maxRedirects: 5,
      // Note: retries and retryDelay are not supported by @nestjs/axios HttpModule
      // Implement retry logic manually in the SmsService if needed
    }),

    // Enable scheduling for cleanup tasks
    ScheduleModule.forRoot(),
    EmailModule,
  ],
  controllers: [OtpController],
  providers: [
    OtpService,
    SmsService,
    // Add custom providers for configuration, making them injectable
    {
      provide: 'OTP_CONFIG',
      useFactory: () => ({
        isDevelopment: process.env.NODE_ENV === 'development',
        expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES) || 5,
        maxAttemptsPerDay: parseInt(process.env.OTP_MAX_ATTEMPTS_PER_DAY) || 10,
        rateLimitMinutes: parseInt(process.env.OTP_RATE_LIMIT_MINUTES) || 1,
      }),
    },
    {
      provide: 'SMS_CONFIG',
      useFactory: () => ({
        apiUrl: process.env.NETBEOPEN_API_URL,
        username: process.env.NETBEOPEN_WEBSERVICES_USERNAME,
        token: process.env.NETBEOPEN_WEBSERVICES_TOKEN,
        senderId: process.env.NETBEOPEN_SENDER_ID,
        isDevelopment: process.env.NODE_ENV === 'development',
      }),
    }
  ],
  exports: [
    OtpService,
    SmsService,
    'OTP_CONFIG',
    'SMS_CONFIG'
  ],
})
export class OtpModule {
  constructor() {
    const environment = process.env.NODE_ENV || 'development';
    console.log(`🔧 OTP Module initialized in ${environment.toUpperCase()} mode`);

    if (environment === 'development') {
      console.log('📝 SMS messages will be logged instead of sent (saves credits)');
      console.log('🧪 Enhanced debugging and testing features enabled');
      console.log('⚡ Relaxed rate limiting for easier testing');
    } else {
      console.log('🚀 SMS messages will be sent via NetBeOpeN gateway');
      console.log('💰 SMS credits will be consumed');
      console.log('🔒 Production rate limiting active');
    }
  }
}