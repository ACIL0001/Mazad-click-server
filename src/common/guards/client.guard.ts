import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException, Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ApikeyService } from 'src/modules/apikey/apikey.service';
import { RoleCode } from 'src/modules/apikey/entity/appType.entity';

@Injectable()
export class SellerGuard implements CanActivate {
  constructor(
    @Inject(ApikeyService) private readonly apikeyService: ApikeyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const key = request.headers['x-access-key'];
    if (!key) {
      throw new UnauthorizedException('API key is required');
    }
    const apikey = await this.apikeyService.validateApiKey(key);
    
    // Allow CLIENT, PROFESSIONAL, and RESELLER roles for seller functionality
    const allowedRoles = [RoleCode.CLIENT, RoleCode.PROFESSIONAL, RoleCode.RESELLER];
    if (!allowedRoles.includes(apikey.type as RoleCode)) {
      throw new ForbiddenException('Access denied. This resource requires CLIENT, PROFESSIONAL, or RESELLER role.');
    }
    return true;
  }
}