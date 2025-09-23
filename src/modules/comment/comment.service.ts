import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Comment, CommentDocument } from './schema/comment.schema';
import { Bid, BidDocument } from '../bid/schema/bid.schema';

@Injectable()
export class CommentService {
  constructor(
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    @InjectModel(Bid.name) private bidModel: Model<BidDocument>,
  ) {}

  async create(comment: string, user: string) {
    const created = new this.commentModel({ comment, user });
    return created.save();
  }

  async findById(id: string) {
    return this.commentModel.findById(id).populate('user').exec();
  }

  async createCommentForBid(comment: string, user: string, bidId: string) {
    const created = await this.create(comment, user);
    await this.bidModel.findByIdAndUpdate(
      bidId,
      { $push: { comments: created._id } },
      { new: true }
    );
    return created;
  }

  // Optional: Fetch all comments for a bid (if needed)
  // async findByBid(bidId: string) {
  //   // Implementation depends on how comments are linked to bids
  // }

  async getBidWithComments(bidId: string) {
    return this.bidModel.findById(bidId)
      .populate({
        path: 'comments',
        populate: { path: 'user' }
      })
      .populate('owner')
      .populate('productCategory')
      .exec();
  }
} 