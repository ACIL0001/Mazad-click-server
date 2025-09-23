import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { SessionService } from 'src/modules/session/session.service';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  logger = new Logger('AuthGuard');
  constructor(
    private readonly sessionService: SessionService,
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
    const token = this.extractToken(request);

    if (!token) throw new UnauthorizedException('Token not found');

    try {
      const session = await this.sessionService.ValidateSession(token);
      request.session = session;
    } catch (error) {
      this.logger.error(error);
      throw new UnauthorizedException('Invalid token');
    }

    return true;
  }

  private extractToken(request: Request) {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    console.log('🔐 AuthGuard - Authorization header:', request.headers.authorization);
    console.log('🔐 AuthGuard - Token type:', type);
    console.log('🔐 AuthGuard - Token present:', !!token);
    console.log('🔐 AuthGuard - Token preview:', token ? token.substring(0, 20) + '...' : 'none');

    return type == 'Bearer' ? token : undefined;
  }
}