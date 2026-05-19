import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AttachmentController } from './attachment.controller';
import { AttachmentService } from './attachment.service';
import { Attachment, AttachmentSchema } from './schema/attachment.schema';
import { MulterModule } from '@nestjs/platform-express';
import { multerConfigFactory } from '../../configs/multer.config';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Attachment.name, schema: AttachmentSchema },
    ]),
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: multerConfigFactory,
      inject: [ConfigService],
    })
  ],
  controllers: [AttachmentController],
  providers: [AttachmentService],
  exports: [AttachmentService],
})
export class AttachmentModule { }
