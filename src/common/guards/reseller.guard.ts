import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ProtectedRequest } from '../../types/request.type';
import { RoleCode } from 'src/modules/apikey/entity/appType.entity';

@Injectable()
export class BuyerGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<ProtectedRequest>();

    if (!request.session) {
      console.log('No session found in request');
      throw new UnauthorizedException('Session not found');
    }

    const user = request.session.user;
    if (!user) {
      console.log('No user found in session');
      throw new UnauthorizedException('User not authenticated');
    }

    console.log('User account type:', user.type);
    
    // Allow CLIENT, PROFESSIONAL, and RESELLER roles for buyer functionality
    const allowedRoles = [RoleCode.CLIENT, RoleCode.PROFESSIONAL, RoleCode.RESELLER];
    if (!allowedRoles.includes(user.type as RoleCode)) {
      console.log('User access denied, account type:', user.type, 'allowed roles:', allowedRoles);
      throw new ForbiddenException('Access denied. This resource requires CLIENT, PROFESSIONAL, or RESELLER role.');
    }

    return true;
  }
}