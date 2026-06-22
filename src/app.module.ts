import { Logger, Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import appConfiguration, {
  ConfigKeys,
  validationSchema,
} from './configs/app.config';
import { ApikeyModule } from './modules/apikey/apikey.module';
import { UserModule } from './modules/user/user.module';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nModule,
  QueryResolver,
} from 'nestjs-i18n';
import { AuthModule } from './modules/auth/auth.module';
import * as path from 'path';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { SessionModule } from './modules/session/session.module';
import { OtpModule } from './modules/otp/otp.module';
import { BidModule } from './modules/bid/bid.module';
import { AttachmentModule } from './modules/attachment/attachment.module';
import { NotificationModule } from './modules/notification/notification.module';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './common/guards/auth.guard';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';

import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import { ServeStaticModule } from '@nestjs/serve-static';

// Helper function to generate unique filenames
const generateUniqueFilename = (req, file, callback) => {
  const name = file.originalname.split('.')[0];
  const fileExtName = extname(file.originalname);
  const randomName = Array(4)
    .fill(null)
    .map(() => Math.round(Math.random() * 16).toString(16))
    .join('');
  callback(null, `${name}-${randomName}${fileExtName}`);
};

// Helper function to ensure upload directory exists
const ensureUploadsDirectoryExists = (destinationPath) => {
  if (!fs.existsSync(destinationPath)) {
    fs.mkdirSync(destinationPath, { recursive: true });
  }
};

const UPLOADS_DIR = 'uploads'; // Relative to project root
import { ChatModule } from './modules/chat/chat.module';
import { MessageModule } from './modules/messages/messages.module';
import { IdentityModule } from './modules/identity/identity.module';
import { CategoryModule } from './modules/category/category.module';
import { SubCategoryModule } from './modules/subcategory/subcategory.module';
import { ReviewModule } from './modules/review';
import { StatsModule } from './modules/stats/stats.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { CommentModule } from './modules/comment/comment.module';
import { TermsModule } from './modules/terms/terms.module';
import { SellerStatsModule } from './modules/seller-stats/seller-stats.module';
import { TenderModule } from './modules/tender/tender.module';
import { DirectSaleModule } from './modules/direct-sale/direct-sale.module';
import { AdsModule } from './modules/ads/ads.module';
import { EmailModule } from './modules/email/email.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

import { AppController } from './app.controller';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 50,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 200,
      },
    ]),
    ConfigModule.forRoot({
      isGlobal: true,
      // cache: true,
      envFilePath: ['.env', '.env.developement'],
      load: [appConfiguration],
      validationSchema,
      validationOptions: {
        // allowUnknown: false,
        abortEarly: true,
      },
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const logger = new Logger('MongooseModule');
        const databaseUri = config.get<'string'>(ConfigKeys.DATABASE_URI);
        const databaseName = config.get<'string'>(ConfigKeys.DATABASE_NAME);
        return {
          uri: databaseUri,
          dbName: databaseName,
          connectionFactory: (connection) => {
            connection.on('connected', () => {
            });

            connection.on('error', (error) => {
              logger.error('❌ MongoDB connection error:', error);
            });

            connection.on('disconnected', () => {
            });

            return connection;
          },
        };
      },
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'fr',
      loaderOptions: {
        path: fs.existsSync(path.join(__dirname, 'i18n'))
          ? path.join(__dirname, 'i18n')
          : path.join(process.cwd(), 'src/i18n'),
        watch: true,
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        AcceptLanguageResolver,
        new HeaderResolver(['x-lang']),
      ],
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const logger = new Logger('CacheModule');
        const disableRedis = config.get('DISABLE_REDIS') === 'true';

        if (disableRedis) {
          return {
            ttl: 1000 * 60 * 4, // 4 minutes
            max: 100,
          };
        }

        try {
          // Try to connect to Redis
          const store = await redisStore({
            socket: {
              host: config.get('REDIS_HOST'),
              port: config.get('REDIS_PORT'),
              reconnectStrategy: (retries, cause) => {
                if (retries > 10) {
                  logger.error('Redis reconnection attempts exceeded');
                  return false; // Stop retrying
                }
                return Math.min(retries * 50, 2000); // Return delay in ms
              },
            },
          });
          return {
            store: store,
            ttl: 1000 * 60 * 4,
          };
        } catch (error) {
          return {
            ttl: 1000 * 60 * 4,
            max: 100,
          };
        }
      },
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      global: true,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        return { secret: config.get(ConfigKeys.JWT_SECRET_KEY) };
      },
    }),
    MulterModule.registerAsync({
      imports: [ConfigModule], // Optional: if you need configService
      useFactory: async (configService: ConfigService) => {
        const destinationPath = join(process.cwd(), UPLOADS_DIR); // process.cwd() gives project root
        ensureUploadsDirectoryExists(destinationPath);
        return {
          storage: diskStorage({
            destination: destinationPath,
            filename: generateUniqueFilename,
          }),
          limits: { fileSize: 1024 * 1024 * 10 }, // 10MB max
          fileFilter: (req, file, cb) => {
            if (file.mimetype.match(/\/(jpg|jpeg|png|gif|webp|pdf|msword|vnd.openxmlformats-officedocument.wordprocessingml.document)$/)) {
              cb(null, true);
            } else {
              cb(new Error('Unsupported file type. Only images and documents are allowed.'), false);
            }
          },
        };
      },
      inject: [ConfigService], // Optional: if you need configService
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), UPLOADS_DIR),
      serveRoot: '/static', // Files will be available under http://localhost:port/static/<filename>
    }),
    ScheduleModule.forRoot(),
    ApikeyModule,
    UserModule,
    AuthModule,
    SessionModule,
    OtpModule,
    BidModule,
    AttachmentModule,
    NotificationModule,
    ChatModule,
    MessageModule,
    IdentityModule,
    CategoryModule,
    SubCategoryModule,
    ReviewModule,
    StatsModule,
    SubscriptionModule,
    CommentModule,
    TermsModule,
    SellerStatsModule,
    TenderModule,
    DirectSaleModule,
    AdsModule,
    EmailModule,
    SettingsModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    // CsrfMiddleware has been removed because the application uses Bearer tokens,
    // making it immune to CSRF. Double Submit Cookies break in cross-domain
    // setups where frontend JS cannot read backend cookies.
  }
}