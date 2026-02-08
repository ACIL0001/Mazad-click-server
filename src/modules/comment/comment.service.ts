import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Comment, CommentDocument } from './schema/comment.schema';
import { Bid, BidDocument } from '../bid/schema/bid.schema';
import { DirectSale, DirectSaleDocument } from '../direct-sale/schema/direct-sale.schema';
import { Tender, TenderDocument } from '../tender/schema/tender.schema';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/schema/notification.schema';
import { UserService } from '../user/user.service';

@Injectable()
export class CommentService {
  constructor(
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    @InjectModel(Bid.name) private bidModel: Model<BidDocument>,
    @InjectModel(DirectSale.name) private directSaleModel: Model<DirectSaleDocument>,
    @InjectModel(Tender.name) private tenderModel: Model<TenderDocument>,
    private readonly notificationService: NotificationService,
    private readonly userService: UserService,
  ) { }

  private async getSenderName(userId: string): Promise<string> {
    try {
      const user = await this.userService.findOne(userId);
      if (!user) return 'Utilisateur';
      return user.companyName || user.entreprise || (user.firstName ? `${user.firstName} ${user.lastName}` : 'Utilisateur');
    } catch (e) {
      return 'Utilisateur';
    }
  }

  async create(comment: string, user: string, entityId?: string, entityType?: string) {
    const created = new this.commentModel({
      comment,
      user,
      entityId,
      entityType
    });
    return created.save();
  }

  async findById(id: string) {
    return this.commentModel.findById(id).populate('user').populate({ path: 'replies', populate: { path: 'user' } }).exec();
  }

  async createCommentForBid(comment: string, user: string, bidId: string) {
    const created = await this.create(comment, user, bidId, 'BID');
    await this.bidModel.findByIdAndUpdate(
      bidId,
      { $push: { comments: created._id } },
      { new: true }
    );

    // Notify Bid Owner
    const bid = await this.bidModel.findById(bidId);
    if (bid && bid.owner && bid.owner.toString() !== user) {
      const senderName = await this.getSenderName(user);
      await this.notificationService.create(
        bid.owner.toString(),
        NotificationType.COMMENT_RECEIVED,
        'Nouveau commentaire',
        `Vous avez reçu un commentaire sur votre enchère: ${bid.title}`,
        {
          commentId: created._id,
          entityId: bidId,
          entityType: 'BID',
          auctionId: bidId
        },
        user,
        senderName
      );
    }

    return created;
  }

  async createCommentForDirectSale(comment: string, user: string, directSaleId: string) {
    const created = await this.create(comment, user, directSaleId, 'DIRECT_SALE');
    await this.directSaleModel.findByIdAndUpdate(
      directSaleId,
      { $push: { comments: created._id } },
      { new: true }
    );

    // Notify Direct Sale Owner
    const ds = await this.directSaleModel.findById(directSaleId);
    if (ds && ds.owner && ds.owner.toString() !== user) {
      const senderName = await this.getSenderName(user);
      await this.notificationService.create(
        ds.owner.toString(),
        NotificationType.COMMENT_RECEIVED,
        'Nouveau commentaire',
        `Vous avez reçu un commentaire sur votre vente: ${ds.title}`,
        {
          commentId: created._id,
          entityId: directSaleId,
          entityType: 'DIRECT_SALE',
          directSaleId: directSaleId
        },
        user,
        senderName
      );
    }

    return created;
  }

  async createCommentForTender(comment: string, user: string, tenderId: string) {
    const created = await this.create(comment, user, tenderId, 'TENDER');
    await this.tenderModel.findByIdAndUpdate(
      tenderId,
      { $push: { comments: created._id } },
      { new: true }
    );

    // Notify Tender Owner
    const tender = await this.tenderModel.findById(tenderId);
    if (tender && tender.owner && tender.owner.toString() !== user) {
      const senderName = await this.getSenderName(user);
      await this.notificationService.create(
        tender.owner.toString(),
        NotificationType.COMMENT_RECEIVED,
        'Nouveau commentaire',
        `Vous avez reçu un commentaire sur votre appel d'offres: ${tender.title}`,
        {
          commentId: created._id,
          entityId: tenderId,
          entityType: 'TENDER',
          tenderId: tenderId
        },
        user,
        senderName
      );
    }

    return created;
  }

  async replyToComment(id: string, reply: string, user: string) {
    const parentComment = await this.commentModel.findById(id);
    if (!parentComment) throw new NotFoundException('Comment not found');

    const createdReply = await this.create(reply, user, parentComment.entityId, parentComment.entityType);

    await this.commentModel.findByIdAndUpdate(
      id,
      { $push: { replies: createdReply._id } },
      { new: true }
    );

    // Notify Parent Comment Owner (if not self)
    if (parentComment.user && parentComment.user.toString() !== user) {
      const senderName = await this.getSenderName(user);

      const data: any = {
        commentId: createdReply._id,
        parentCommentId: id,
        entityId: parentComment.entityId,
        entityType: parentComment.entityType
      };

      // Add aliases for easier frontend redirection
      if (parentComment.entityType === 'BID') data.auctionId = parentComment.entityId;
      if (parentComment.entityType === 'TENDER') data.tenderId = parentComment.entityId;
      if (parentComment.entityType === 'DIRECT_SALE') data.directSaleId = parentComment.entityId;

      await this.notificationService.create(
        parentComment.user.toString(),
        NotificationType.COMMENT_REPLY,
        'Nouvelle réponse',
        `Quelqu'un a répondu à votre commentaire`,
        data,
        user,
        senderName
      );
    }

    return createdReply;
  }

  async getBidWithComments(bidId: string) {
    return this.bidModel.findById(bidId)
      .populate({
        path: 'comments',
        populate: [
          { path: 'user' },
          {
            path: 'replies',
            populate: { path: 'user' }
          }
        ]
      })
      .populate('owner')
      .populate('productCategory')
      .exec();
  }
} 