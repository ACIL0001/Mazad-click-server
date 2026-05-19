import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Review, ReviewSchema } from './review.schema';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';
import {
  AnnouncementReview,
  AnnouncementReviewSchema,
} from './announcement-review.schema';
import { AnnouncementReviewService } from './announcement-review.service';
import { AnnouncementReviewController } from './announcement-review.controller';
import { User, UserSchema } from '../user/schema/user.schema';
import { Bid, BidSchema } from '../bid/schema/bid.schema';
import {
  DirectSale,
  DirectSaleSchema,
  DirectSalePurchase,
  DirectSalePurchaseSchema,
} from '../direct-sale/schema/direct-sale.schema';
import { Tender, TenderSchema } from '../tender/schema/tender.schema';
import { SessionModule } from '../session/session.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      // Existing like/dislike system — untouched
      { name: Review.name, schema: ReviewSchema },
      { name: User.name, schema: UserSchema },
      // New announcement rating system
      { name: AnnouncementReview.name, schema: AnnouncementReviewSchema },
      { name: Bid.name, schema: BidSchema },
      { name: DirectSale.name, schema: DirectSaleSchema },
      { name: DirectSalePurchase.name, schema: DirectSalePurchaseSchema },
      { name: Tender.name, schema: TenderSchema },
    ]),
    SessionModule,
  ],
  providers: [ReviewService, AnnouncementReviewService],
  controllers: [ReviewController, AnnouncementReviewController],
  exports: [ReviewService, AnnouncementReviewService],
})
export class ReviewModule {} 