import { Module } from '@nestjs/common';
import { ApikeyService } from './apikey.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiKey, ApiKeySchema } from './schema/apikey.schema';
import { ApiKeyController } from './apikey.controller';

@Module({
  imports: [
    MongooseModule.forFeatureAsync([
      {
        name: ApiKey.name,
        useFactory: () => {
          return ApiKeySchema;
        },
      },
    ]),
  ],
  providers: [ApikeyService],
  controllers: [ApiKeyController],
  exports: [ApikeyService],
})
export class ApikeyModule {}
