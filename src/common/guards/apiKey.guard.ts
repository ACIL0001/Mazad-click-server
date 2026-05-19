import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { ApikeyService } from 'src/modules/apikey/apikey.service';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    @Inject(ApikeyService.name) private readonly apikeyService: ApikeyService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const key = request.headers['x-access-key'];
    const apikey = await this.apikeyService.validateApiKey(key);

    if (!apikey.actif)
      throw new ForbiddenException(
        'this app is outdated please consider updating', // FIXME: TRANSLATE THIS
      );

    request.appType = apikey.type;
    return apikey.actif;
  }
}