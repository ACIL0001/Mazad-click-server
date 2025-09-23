import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SellerStatsController } from './seller-stats.controller';
import { SellerStatsService } from './seller-stats.service';
import { Bid, BidSchema } from '../bid/schema/bid.schema';
import { Offer, OfferSchema } from '../bid/schema/offer.schema';
import { User, UserSchema } from '../user/schema/user.schema';
import { Category, CategorySchema } from '../category/schema/category.schema';
import { ViewTracking, ViewTrackingSchema } from './schema/view-tracking.schema';
import { SessionModule } from '../session/session.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Bid.name, schema: BidSchema },
      { name: Offer.name, schema: OfferSchema },
      { name: User.name, schema: UserSchema },
      { name: Category.name, schema: CategorySchema },
      { name: ViewTracking.name, schema: ViewTrackingSchema },
    ]),
    SessionModule,
  ],
  controllers: [SellerStatsController],
  providers: [SellerStatsService],
  exports: [SellerStatsService],
})
export class SellerStatsModule {}
