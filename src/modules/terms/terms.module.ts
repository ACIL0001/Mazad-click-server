import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TermsService } from './terms.service';
import { TermsController } from './terms.controller'; // Assuming you have this
import { Terms, TermsSchema } from './schema/terms.schema';
import { SessionModule } from '../session/session.module'; // Adjust path as needed
import { AttachmentModule } from '../attachment/attachment.module';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { multerConfigFactory } from '../../configs/multer.config';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Terms.name, schema: TermsSchema }
    ]),
    SessionModule, // Add this import
    AttachmentModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: multerConfigFactory,
      inject: [ConfigService],
    }),
  ],
  controllers: [TermsController], // Your controller
  providers: [TermsService],
  exports: [TermsService],
})
export class TermsModule { }