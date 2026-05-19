import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ProtectedRequest } from '../../types/request.type';
import { RoleCode } from 'src/modules/apikey/entity/appType.entity';


@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<ProtectedRequest>();
    const user = request.session.user;

    if (!user || (user.type !== RoleCode.ADMIN && user.type !== RoleCode.SOUS_ADMIN)) {
      throw new ForbiddenException('Only admin or sous-admin users can access this resource');
    }

    return true;
  }
}