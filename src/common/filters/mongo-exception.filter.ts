import { ExceptionFilter, Catch, ArgumentsHost, ConflictException } from '@nestjs/common';
import { MongoError } from 'mongodb';

@Catch(MongoError)
export class MongoExceptionFilter implements ExceptionFilter {
  catch(exception: MongoError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    if (exception.code === 11000) {
      // Duplicate key error
      const keyPattern = (exception as any).keyPattern || {};
      const field = Object.keys(keyPattern)[0] || 'field';
      
      response.status(409).json({
        statusCode: 409,
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
        error: 'Conflict',
      });
      return;
    }

    response.status(500).json({
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
  }
}
