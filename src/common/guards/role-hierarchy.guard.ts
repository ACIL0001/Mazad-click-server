import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { ProtectedRequest } from '../../types/request.type';
import { RoleCode } from 'src/modules/apikey/entity/appType.entity';

// Define role hierarchy levels (higher number = more permissions)
export const ROLE_HIERARCHY = {
  [RoleCode.CLIENT]: 1,
  [RoleCode.PROFESSIONAL]: 2,
  [RoleCode.RESELLER]: 3,
  [RoleCode.SOUS_ADMIN]: 4,
  [RoleCode.ADMIN]: 5,
};

// Decorator to set minimum required role
export const MinRole = (role: RoleCode) => {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('minRole', role, descriptor.value);
  };
};

@Injectable()
export class RoleHierarchyGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const requiredRole = this.reflector.get<RoleCode>('minRole', context.getHandler());
    
    if (!requiredRole) {
      return true; // No role requirement specified
    }

    const request = context.switchToHttp().getRequest<ProtectedRequest>();
    const user = request.session.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const userRoleLevel = ROLE_HIERARCHY[user.type as RoleCode] || 0;
    const requiredRoleLevel = ROLE_HIERARCHY[requiredRole] || 0;

    if (userRoleLevel < requiredRoleLevel) {
      throw new ForbiddenException(`Insufficient permissions. Required: ${requiredRole}, User: ${user.type}`);
    }

    return true;
  }
}

// Helper decorator to easily set role requirements
export const RequiresRole = (role: RoleCode) => MinRole(role);
