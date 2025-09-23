import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TenderController } from './tender.controller';
import { TenderService } from './tender.service';
import { Tender, TenderSchema } from './schema/tender.schema';
import { TenderBid, TenderBidSchema } from './schema/tender-bid.schema';
import { CategoryModule } from '../category/category.module';
import { SessionModule } from '../session/session.module';
import { NotificationModule } from '../notification/notification.module';
import { UserModule } from '../user/user.module';
import { AttachmentModule } from '../attachment/attachment.module';
import { ApikeyModule } from '../apikey/apikey.module';
import { SocketModule } from 'src/socket/socket.module';
import { ChatModule } from '../chat/chat.module';
import { Chat, ChatSchema } from '../chat/schema/chat.schema';
import { User, UserSchema } from '../user/schema/user.schema';
import { CommentModule } from '../comment/comment.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tender.name, schema: TenderSchema },
      { name: TenderBid.name, schema: TenderBidSchema },
      { name: Chat.name, schema: ChatSchema },
      { name: User.name, schema: UserSchema },
    ]),
    CategoryModule,
    SessionModule,
    NotificationModule,
    UserModule,
    AttachmentModule,
    ApikeyModule,
    SocketModule,
    ChatModule,
    CommentModule,
  ],
  controllers: [TenderController],
  providers: [TenderService],
  exports: [TenderService],
})
export class TenderModule {
  constructor() {
    console.log('✅ TenderModule loaded successfully');
    console.log('📋 Controllers:', ['TenderController']);
    console.log('🔧 Providers:', ['TenderService']);
  }
}
