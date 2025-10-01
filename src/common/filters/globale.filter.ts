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
  
  @Catch(HttpException)
  export class GlobaleExceptionFilter implements ExceptionFilter {
    catch(exception: HttpException, host: ArgumentsHost) {
      const logger = new Logger('Http Exception');
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<Response>();
      const request = ctx.getRequest<Request>();
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
      // response.status(status).json({
      //   statusCode: status,
      //   path: request.url,
      //   message: exception.message,
      //   //   timestamp: new Date().toISOString(),
      //   error:
      //     process.env.NODE_ENV === ENVIRONMENT.DEVELLOPMENT
      //       ? exception.stack
      //       : null,
      //   //   error: exception.,
      // });
    }
  }