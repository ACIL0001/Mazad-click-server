import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ConfigKeys } from './configs/app.config';
import { WinstonModule } from 'nest-winston';
import { winstonLoggerOptions } from './configs/logger.config';
import * as morgan from 'morgan';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmetConfig from './configs/helmet.config'; // Ensure this import is correct
import { GlobaleExceptionFilter } from './common/filters/globale.filter';
import { SetupSwagger } from './configs/swagger.config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: WinstonModule.createLogger(winstonLoggerOptions),
  });

  // ... (keep all your existing middleware, CORS, helmet config)

  // Use PORT from environment variable (Render provides this) or fallback
  const port = process.env.PORT || 3000;
  
  await app.listen(port, () => {
    const logger = new Logger('MazadClick System');
    logger.log(`Server is running and listening on port ${port}`);
    console.log(`Server is running and listening on port ${port}`);
  });
}
bootstrap();