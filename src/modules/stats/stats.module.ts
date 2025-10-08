import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

// Import schemas directly
import { User, UserSchema } from '../user/schema/user.schema';
import { Bid, BidSchema } from '../bid/schema/bid.schema';
import { Category, CategorySchema } from '../category/schema/category.schema';
import { Tender, TenderSchema } from '../tender/schema/tender.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Bid.name, schema: BidSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Tender.name, schema: TenderSchema },
    ]),
  ],
  controllers: [StatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}