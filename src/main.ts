import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ConfigKeys } from './configs/app.config';
import { WinstonModule } from 'nest-winston';
import { winstonLoggerOptions } from './configs/logger.config';
import morgan from 'morgan';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmetConfig from './configs/helmet.config'; // Ensure this import is correct
import { GlobaleExceptionFilter } from './common/filters/globale.filter';
import { MongoExceptionFilter } from './common/filters/mongo-exception.filter';
import { SetupSwagger } from './configs/swagger.config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import compression from 'compression';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error'], // Silences verbose NestJS init logs and warnings
  });

  // GZIP Compression for ultra-fast API payload delivery
  app.use(compression());
  
  // Parse Cookie header and populate req.cookies
  app.use(cookieParser());

  // app.use(morgan('combined')); // Disabled to stop HTTP request spam

  const allowedOrigins = [
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3004',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
    'http://127.0.0.1:3003',
    'http://127.0.0.1:3004',

    'https://mazad-click-buyer.vercel.app',
    'https://mazad-click-seller.vercel.app',
    'https://mazad-click-backoffice.vercel.app',
    'https://mazad-click-admin.vercel.app',
    'https://mazad-click-backoffice-jtet.vercel.app',
    'https://mazad-click-seller-eq4j.vercel.app',
    'https://mazadclick.vercel.app',
    'https://mazadclick.vercel.app/', // Keep both with and without trailing slash
    'https://admin.mazad.click',
    'https://dashbord.seller.mazad.click',
  ];

  const allowedOriginPatterns = [
    /^https?:\/\/localhost:30\d{2}$/,
    /^https:\/\/mazad-click-(buyer|seller|backoffice|admin)(-[a-z0-9-]+)?\.vercel\.app$/,
    /^https:\/\/buyer-mazad\.vercel\.app$/,
    /^https:\/\/mazadclick\.vercel\.app\/?$/, // Allow with or without trailing slash
    /^https:\/\/dashbord\.seller\.mazad\.click\/?$/,
    /^https:\/\/admin\.mazad\.click\/?$/,
  ];

  app.enableCors({
    origin: (origin, callback) => {


      // Allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin) {

        return callback(null, true);
      }

      const isAllowed =
        allowedOrigins.includes(origin) ||
        allowedOriginPatterns.some((rx) => rx.test(origin));

      if (isAllowed) {

        return callback(null, true);
      }


      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
    // Include all custom headers used by the frontend
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'x-api-key',
      'x-access-key',
      'X-Requested-With',
      'Origin',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers',
      'x-csrf-token'
    ],
    exposedHeaders: [
      'Content-Length',
      'X-Foo',
      'X-Bar'
    ],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Helmet Configuration (which sets CSP)
  app.use(helmetConfig);


  // Custom middleware for static assets CORS (as a fallback/double-check for images)
  // This helps ensure CORS headers are explicitly set for static files if helmet's CSP isn't enough alone
  app.use(['/static', '/server/uploads'], (req, res, next) => {
    const origin = req.headers.origin;
    const isAllowedOrigin =
      !!origin &&
      (allowedOrigins.includes(origin) ||
        allowedOriginPatterns.some((rx) => rx.test(origin)));

    if (isAllowedOrigin && origin) {
      res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
    res.header(
      'Access-Control-Allow-Headers',
      'Content-Type, Accept, Authorization, x-api-key, x-access-key, accept-language, X-Requested-With, Origin, Access-Control-Request-Method, Access-Control-Request-Headers, x-csrf-token',
    );
    next();
  });

  // Enhanced CORS middleware for OTP endpoints to ensure proper headers
  app.use('/otp', (req, res, next) => {
    const origin = req.headers.origin;
    console.log('🔍 OTP CORS Middleware - Origin:', origin);

    // Check if origin is allowed
    const isAllowed = allowedOrigins.includes(origin) ||
      /^https:\/\/mazadclick\.vercel\.app\/?$/.test(origin);

    if (isAllowed) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, x-api-key, x-access-key, accept-language, X-Requested-With, Origin, Access-Control-Request-Method, Access-Control-Request-Headers, x-csrf-token');
      console.log('✅ OTP CORS: Headers set for origin:', origin);
    } else {
      console.log('❌ OTP CORS: Origin not allowed:', origin);
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  });

  // Dedicated Auth middleware for token validation
  app.use('/auth', (req, res, next) => {
    const origin = req.headers.origin;

    // Check if origin is allowed
    const isAllowed = allowedOrigins.includes(origin) ||
      /^https:\/\/mazadclick\.vercel\.app\/?$/.test(origin);

    if (isAllowed) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, x-api-key, x-access-key, accept-language, X-Requested-With, Origin, Access-Control-Request-Method, Access-Control-Request-Headers, x-csrf-token');
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  });

  app.useGlobalFilters(new GlobaleExceptionFilter(), new MongoExceptionFilter());
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
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/server/uploads/',
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
