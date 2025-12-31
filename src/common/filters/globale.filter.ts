import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ENVIRONMENT } from 'src/configs/app.config';

@Catch()
export class GlobaleExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Handle non-HTTP exceptions (unhandled errors)
    if (!(exception instanceof HttpException)) {
      const logger = new Logger('Unhandled Exception');
      const error = exception as Error;

      logger.error('Unhandled exception:', error.message);
      console.error('🔥 Unhandled exception details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        url: request.url,
        method: request.method,
      });

      return response.status(500).json({
        statusCode: 500,
        message: 'Internal server error',
        error: error.message || 'Unknown error',
        path: request.url,
        stack: process.env.NODE_ENV === ENVIRONMENT.DEVELLOPMENT ? error.stack : undefined,
      });
    }

    // Handle HTTP exceptions (existing logic)
    const logger = new Logger('Http Exception');
    const status = exception.getStatus();

    logger.error(exception);

    // Log detailed validation errors
    if (exception instanceof BadRequestException) {
      const exceptionResponse = exception.getResponse();
      console.log('BadRequestException details:', {
        message: exceptionResponse,
        url: request.url,
        method: request.method,
        body: request.body,
        status
      });
    }

    console.log(exception.getResponse());
    response.status(status).json(
      Object.assign(exception.getResponse(), {
        stack:
          process.env.NODE_ENV === ENVIRONMENT.DEVELLOPMENT
            ? exception.stack
            : null,
      }),
    );
  }
}