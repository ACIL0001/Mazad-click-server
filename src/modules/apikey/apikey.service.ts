import {
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ApiKey } from './schema/apikey.schema';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { ConfigKeys } from 'src/configs/app.config';
import { RoleCode } from './entity/appType.entity';

@Injectable()
export class ApikeyService implements OnModuleInit {
  private readonly logger = new Logger(ApikeyService.name);

  constructor(
    @InjectModel(ApiKey.name) private readonly apikeyModel: Model<ApiKey>,
    private readonly configService: ConfigService,
  ) {}

  // Initialize api keys  on DATABASE
  async onModuleInit() {
    const apikeys = await this.apikeyModel.find();

    const apiKeysData = {
      clientApiKey: this.configService.get(ConfigKeys.Client_API_KEY),
      adminApiKey: this.configService.get(ConfigKeys.ADMIN_API_KEY),
    };
    if (apikeys.length >= Object.keys(apiKeysData).length) return;

    this.logger.log('Initializing API KEYS');

    await this.apikeyModel.insertMany([
      {
        key: apiKeysData.clientApiKey,
        type: RoleCode.CLIENT,
      },
      {
        key: apiKeysData.adminApiKey,
        type: RoleCode.ADMIN,
      },
    ]);
  }

  async validateApiKey(key: string) {
    const apiKey = await this.apikeyModel.findOne({ key });
    if (!apiKey) {
      throw new ForbiddenException('Invalid API Key'); // FIXME: TRANSLATE THIS
    }
    return apiKey;
  }
}
