import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

// Import schemas directly
import { User, UserSchema } from '../user/schema/user.schema';
import { Bid, BidSchema } from '../bid/schema/bid.schema';
import { Category, CategorySchema } from '../category/schema/category.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Bid.name, schema: BidSchema },
      { name: Category.name, schema: CategorySchema },
    ]),
  ],
  controllers: [StatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {} 