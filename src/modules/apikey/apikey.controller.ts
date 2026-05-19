import { Controller } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

@Controller('apikey')
export class ApiKeyController {
  constructor(readonly i18nService: I18nService) {}
}
