import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { SessionService } from 'src/modules/session/session.service';

@Injectable()
export class AuthGuard implements CanActivate {
  logger = new Logger('AuthGuard');
  constructor(private readonly sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
    console.log(request.headers.authorization?.split(' '));

    return type == 'Bearer' ? token : undefined;
  }
}