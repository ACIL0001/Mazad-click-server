import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Review, ReviewDocument, ReviewType } from './review.schema';
import { User } from '../user/schema/user.schema';

@Injectable()
export class ReviewService {
  constructor(
    @InjectModel(Review.name) private readonly reviewModel: Model<ReviewDocument>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async likeUser(reviewerId: string, targetUserId: string, comment?: string) {
    return this.handleReview(reviewerId, targetUserId, 'like', comment);
  }

  async dislikeUser(reviewerId: string, targetUserId: string, comment?: string) {
    return this.handleReview(reviewerId, targetUserId, 'dislike', comment);
  }

  private async handleReview(reviewerId: string, targetUserId: string, type: ReviewType, comment?: string) {
    if (reviewerId === targetUserId) throw new BadRequestException('Cannot review yourself');
    let review = await this.reviewModel.findOne({ reviewer: reviewerId, targetUser: targetUserId });
    if (!review) {
      review = await this.reviewModel.create({ reviewer: reviewerId, targetUser: targetUserId, type, comment });
    } else if (review.type === type) {
      throw new BadRequestException(`You have already ${type}d this user`);
    } else {
      review.type = type;
      review.updatedAt = new Date();
      if (comment !== undefined) review.comment = comment;
      await review.save();
    }
    await this.updateUserRate(targetUserId);
    return review;
  }

  private async updateUserRate(targetUserId: string) {
    let likes = await this.reviewModel.countDocuments({ targetUser: targetUserId, type: 'like' });
    let dislikes = await this.reviewModel.countDocuments({ targetUser: targetUserId, type: 'dislike' });
    const user = await this.userModel.findById(targetUserId);
    if (!user) return;
    let updated = false;
    if (likes >= 10) {
      user.rate = Math.min(user.rate + 1, 10);
      updated = true;
      await this.reviewModel.deleteMany({ targetUser: targetUserId, type: 'like' });
      likes = 0;
    }
    if (dislikes >= 2) {
      if (likes >= 4) {
        const likeDocs = await this.reviewModel.find({ targetUser: targetUserId, type: 'like' }).limit(4);
        const likeIds = likeDocs.map(doc => doc._id);
        await this.reviewModel.deleteMany({ _id: { $in: likeIds } });
        await this.reviewModel.deleteMany({ targetUser: targetUserId, type: 'dislike' });
      } else {
        user.rate = Math.max(user.rate - 1, 1);
        updated = true;
        await this.reviewModel.deleteMany({ targetUser: targetUserId, type: 'dislike' });
      }
    }
    if (updated) await user.save();
  }

  async adjustUserRateByAdmin(userId: string, delta: number) {
    if (![1, -1].includes(delta)) {
      throw new BadRequestException('Delta must be +1 or -1');
    }
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    user.rate = Math.max(1, Math.min(10, (user.rate || 1) + delta));
    await user.save();
    return user;
  }
} 