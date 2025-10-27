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

    this.logger.debug('AuthGuard validation:', {
      url: request.url,
      method: request.method,
      hasToken: !!token,
      tokenPreview: token ? token.substring(0, 20) + '...' : 'none',
      headers: {
        authorization: request.headers.authorization ? 'Bearer ***' : 'none',
        'x-access-key': request.headers['x-access-key'] ? '***' : 'none'
      }
    });

    if (!token) {
      this.logger.warn('Token not found in request headers', {
        url: request.url,
        headers: Object.keys(request.headers)
      });
      throw new UnauthorizedException('Token not found');
    }

    try {
      const session = await this.sessionService.ValidateSession(token);
      request.session = session;
      this.logger.debug('Session validated successfully:', {
        userId: session.user._id,
        userType: session.user.type
      });
    } catch (error) {
      this.logger.error('Token validation failed:', {
        error: error.message,
        tokenPreview: token.substring(0, 20) + '...',
        url: request.url
      });
      throw new UnauthorizedException('Invalid token');
    }

    return true;
  }

  private extractToken(request: Request) {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type == 'Bearer' ? token : undefined;
  }
}