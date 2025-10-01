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

  app.use(morgan('combined'));

  // CORS Configuration
  const allowedOrigins = [
    'http://localhost:3001', 
    'http://localhost:3002', 
    'http://localhost:3003',
    'http://localhost:3004',
    'http://localhost:3005', // Backoffice
    'http://localhost:3006',
    'http://localhost:3007',
    'http://localhost:3008',
    'http://localhost:3009',
    'http://localhost:3010',
    'https://mazad-click-buyer.vercel.app',
    'https://mazad-click-seller.vercel.app',
    'https://mazad-click-backoffice.vercel.app',
    'https://mazad-click-admin.vercel.app',
  ];
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'x-api-key', 'x-access-key'],
  });

  // Helmet Configuration (which sets CSP)
  app.use(helmetConfig);


  // Custom middleware for static assets CORS (as a fallback/double-check for images)
  // This helps ensure CORS headers are explicitly set for static files if helmet's CSP isn't enough alone
  app.use('/static', (req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, x-api-key, x-access-key');
    next();
  });
  app.useGlobalFilters(new GlobaleExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      forbidUnknownValues: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Serve static files
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/static/',
  });

  SetupSwagger(app);

  const configService = app.get<ConfigService>(ConfigService);
  
  // Use PORT from environment variable (Render provides this) or fallback to config
  const port = process.env.PORT || configService.get(ConfigKeys.PORT) || 3000;
  
  await app.listen(port, () => {
    const logger = new Logger('MazadClick System');
    logger.log(`Server is running and listening on port ${port}`);
    console.log(`Server is running and listening on port ${port}`);
  });
}
bootstrap();