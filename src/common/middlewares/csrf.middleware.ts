import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Only intercept mutating requests
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      
      // Bypass CSRF for analytics routes that use sendBeacon
      if (req.originalUrl.startsWith('/analytics') || req.originalUrl.startsWith('/api/analytics')) {
        return next();
      }

      // Bypass CSRF for authentication entry points (they create the session, no session to exploit)
      const authBypassRoutes = ['/auth/signin', '/auth/signup', '/api/auth/signin', '/api/auth/signup'];
      if (authBypassRoutes.some(route => req.originalUrl.startsWith(route))) {
        return next();
      }

      const csrfCookie = req.cookies['csrf_token'];
      const csrfHeader = req.headers['x-csrf-token'];

      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        console.warn(`[CSRF] Validation failed for ${req.method} ${req.originalUrl}. Cookie: ${!!csrfCookie}, Header: ${!!csrfHeader}`);
        throw new ForbiddenException('CSRF Token Validation Failed');
      }
    }
    next();
  }
}
