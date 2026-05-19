import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ProtectedRequest } from '../../types/request.type';
import { RoleCode } from 'src/modules/apikey/entity/appType.entity';

@Injectable()
export class SousAdminGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<ProtectedRequest>();
    const user = request.session.user;

    if (!user || (user.type !== RoleCode.SOUS_ADMIN && user.type !== RoleCode.ADMIN)) {
      throw new ForbiddenException('Only sous-admin or admin users can access this resource');
    }

    return true;
  }
}
