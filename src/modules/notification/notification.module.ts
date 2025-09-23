import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationService } from './notification.service';
import { Notification, NotificationSchema } from './schema/notification.schema';
import { NotificationController } from './notification.controller';
import { SessionModule } from '../session/session.module';
// import { NotificationGateway } from 'src/socket/socket.gateway';
import { ApikeyModule } from '../apikey/apikey.module';
import { SocketGateway } from 'src/socket/socket.gateway';


@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
    SessionModule,
    ApikeyModule,
  ],
  controllers: [NotificationController],
  providers: [NotificationService, SocketGateway],
  exports: [NotificationService],
})
export class NotificationModule {}