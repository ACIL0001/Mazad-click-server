import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BidController } from './bid.controller';
import { OfferController } from './offer.controller';
import { ParticipantController } from './participant.controller';
import { AutoBidController } from './auto-bid.controller';
import { BidService } from './bid.service';
import { OfferService } from './offer.service';
import { ParticipantService } from './participant.service';
import { AutoBidService } from './auto-bid.service';
import { AuctionNotificationService } from './auction-notification.service';
import { Bid, BidSchema } from './schema/bid.schema';
import { Participant, ParticipantSchema } from './schema/participant.schema';
import { Offer, OfferSchema } from './schema/offer.schema';
import { AutoBid, AutoBidSchema } from './schema/auto.schema';
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
import { SearchModule } from '../search/search.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Bid.name, schema: BidSchema },
      { name: Participant.name, schema: ParticipantSchema },
      { name: Offer.name, schema: OfferSchema },
      { name: AutoBid.name, schema: AutoBidSchema },
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
    SearchModule,
  ],
  controllers: [BidController, OfferController, ParticipantController, AutoBidController],
  providers: [BidService, OfferService, ParticipantService, AutoBidService, AuctionNotificationService],
  exports: [BidService, OfferService, ParticipantService, AutoBidService, AuctionNotificationService],
})
export class BidModule {
  constructor() {
    console.log('✅ BidModule loaded successfully');
    console.log('📋 Controllers:', ['BidController', 'OfferController', 'ParticipantController', 'AutoBidController']);
    console.log('🔧 Providers:', ['BidService', 'OfferService', 'ParticipantService', 'AutoBidService']);
  }
}
