import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
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

@Module({
  imports: [
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
        
        logger.log(`🔗 Attempting to connect to MongoDB...`);
        logger.log(`📊 Database URI: ${databaseUri}`);
        logger.log(`📊 Database Name: ${databaseName}`);
        
        return {
          uri: databaseUri,
          dbName: databaseName,
          connectionFactory: (connection) => {
            connection.on('connected', () => {
              logger.log('✅ MongoDB connected successfully');
            });
            
            connection.on('error', (error) => {
              logger.error('❌ MongoDB connection error:', error);
            });
            
            connection.on('disconnected', () => {
              logger.warn('⚠️ MongoDB disconnected');
            });
            
            return connection;
          },
        };
      },
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'fr',
      loaderOptions: {
        path: path.join(__dirname, 'i18n/'),
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
        
        try {
          // Try to connect to Redis
          const store = await redisStore({
            socket: {
              host: config.get('REDIS_HOST'),
              port: config.get('REDIS_PORT'),
              reconnectStrategy: (retries) => {
                if (retries > 10) {
                  logger.error('Redis reconnection attempts exceeded');
                  throw new Error('Redis reconnection attempts exceeded');
                }
                return Math.min(retries * 50, 2000);
              },
            },
          });
          
          logger.log('✅ Redis cache connected successfully');
          return {
            store: store,
            ttl: 1000 * 60 * 4,
          };
        } catch (error) {
          logger.warn('⚠️ Redis not available, falling back to in-memory cache');
          logger.warn('💡 To use Redis cache, install and start Redis server');
          
          // Fall back to in-memory cache
          return {
            ttl: 1000 * 60 * 4, // 4 minutes
            max: 100, // Maximum number of items in cache
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
          // limits: { fileSize: 1024 * 1024 * 5 }, // Example: 5MB file size limit
          // fileFilter: (req, file, cb) => { // Example: image file filter
          //   if (file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
          //     cb(null, true);
          //   } else {
          //     cb(new Error('Unsupported file type'), false);
          //   }
          // },
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
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}