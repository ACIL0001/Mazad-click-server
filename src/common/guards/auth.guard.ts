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
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() === 'ws') {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    // Attempt validation if token exists, regardless of route public status
    if (token) {
      try {
        const session = await this.sessionService.ValidateSession(token);
        request.session = session;

      } catch (error) {
        this.logger.error(`❌ Token validation failed for ${request.url}:`, {
          error: error.message,
          tokenPreview: token.substring(0, 10) + '...',
          stack: error.stack
        });
        // We do NOT throw here yet. We check if it's public first.
      }
    } else {
      this.logger.warn(`⚠️ No token found in request to ${request.url}`);
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // If not public, we MUST have a valid session
    if (!token) {
      this.logger.warn(`⛔ Unauthorized: Token missing for ${request.url}`);
      throw new UnauthorizedException('Token not found');
    }

    if (!request.session) {
      this.logger.warn(`⛔ Unauthorized: Invalid session/token for ${request.url}`);
      throw new UnauthorizedException('Invalid token');
    }

    return true;
  }

  private extractToken(request: Request) {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type == 'Bearer' ? token : undefined;
  }
}