import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Comment, CommentSchema } from './schema/comment.schema';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';
import { Bid, BidSchema } from '../bid/schema/bid.schema';
import { DirectSale, DirectSaleSchema } from '../direct-sale/schema/direct-sale.schema';
import { Tender, TenderSchema } from '../tender/schema/tender.schema';
import { NotificationModule } from '../notification/notification.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Comment.name, schema: CommentSchema },
      { name: Bid.name, schema: BidSchema },
      { name: DirectSale.name, schema: DirectSaleSchema },
      { name: Tender.name, schema: TenderSchema },
    ]),
    NotificationModule,
    UserModule,
  ],
  controllers: [CommentController],
  providers: [CommentService],
  exports: [MongooseModule, CommentService],
})
export class CommentModule { } 