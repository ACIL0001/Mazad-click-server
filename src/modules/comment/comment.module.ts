import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Comment, CommentSchema } from './schema/comment.schema';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';
import { Bid, BidSchema } from '../bid/schema/bid.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Comment.name, schema: CommentSchema },
      { name: Bid.name, schema: BidSchema },
    ]),
  ],
  controllers: [CommentController],
  providers: [CommentService],
  exports: [MongooseModule, CommentService],
})
export class CommentModule {} 