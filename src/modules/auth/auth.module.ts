import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserModule } from '../user/user.module';
import { SessionModule } from '../session/session.module';
import { OtpModule } from '../otp/otp.module';
import { AttachmentModule } from '../attachment/attachment.module';
import { multerConfigFactory } from '../../configs/multer.config';

@Module({
  imports: [
    UserModule,
    SessionModule,
    OtpModule,
    AttachmentModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: multerConfigFactory,
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule { }
