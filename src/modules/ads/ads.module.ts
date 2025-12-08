import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';
import { Ad, AdSchema } from './schema/ads.schema';
import { AttachmentModule } from '../attachment/attachment.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Ad.name, schema: AdSchema },
    ]),
    AttachmentModule,
  ],
  controllers: [AdsController],
  providers: [AdsService],
  exports: [AdsService],
})
export class AdsModule {}

