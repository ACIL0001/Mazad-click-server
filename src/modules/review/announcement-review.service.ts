import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AnnouncementReview,
  AnnouncementReviewDocument,
} from './announcement-review.schema';
import { Bid, BidDocument } from '../bid/schema/bid.schema';
import {
  DirectSale,
  DirectSaleDocument,
  DirectSalePurchase,
  DirectSalePurchaseDocument,
  PURCHASE_STATUS,
} from '../direct-sale/schema/direct-sale.schema';
import { Tender, TenderDocument } from '../tender/schema/tender.schema';
import { User, UserDocument } from '../user/schema/user.schema';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_WINDOW_DAYS = 30;

@Injectable()
export class AnnouncementReviewService {
  constructor(
    @InjectModel(AnnouncementReview.name)
    private reviewModel: Model<AnnouncementReviewDocument>,
    @InjectModel(Bid.name) private bidModel: Model<BidDocument>,
    @InjectModel(DirectSale.name) private directSaleModel: Model<DirectSaleDocument>,
    @InjectModel(DirectSalePurchase.name)
    private purchaseModel: Model<DirectSalePurchaseDocument>,
    @InjectModel(Tender.name) private tenderModel: Model<TenderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  // ─────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────

  async createOrUpdateReview(
    reviewerId: string,
    announcementId: string,
    announcementModel: 'Bid' | 'DirectSale' | 'Tender',
    stars: number,
    comment?: string,
  ) {
    if (!Number.isInteger(stars) || stars < 1 || stars > 5)
      throw new BadRequestException('Les étoiles doivent être un entier entre 1 et 5');

    await this.checkEligibility(reviewerId, announcementId, announcementModel);

    const seller = await this.getSellerFromAnnouncement(announcementId, announcementModel);

    await this.reviewModel.findOneAndUpdate(
      { reviewer: reviewerId, announcement: announcementId },
      {
        reviewer: reviewerId,
        announcement: announcementId,
        announcementModel,
        seller,
        stars,
        comment,
      },
      { upsert: true, new: true },
    );

    await this.recalculateAnnouncementRating(announcementId, announcementModel);
    await this.recalculateUserScore(seller.toString());

    return { message: 'Avis enregistré avec succès' };
  }

  async getAnnouncementReviews(announcementId: string) {
    return this.reviewModel
      .find({ announcement: announcementId })
      .populate('reviewer', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getUserScore(userId: string) {
    const user = await this.userModel.findById(userId).select('score rate').lean();
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  /**
   * Lightweight check used by the frontend to decide whether to show the rating popup.
   * Returns eligibility status, when to show it, and when it expires.
   */
  async canReview(
    reviewerId: string,
    announcementId: string,
    announcementModel: 'Bid' | 'DirectSale' | 'Tender',
  ): Promise<{
    eligible: boolean;
    alreadyReviewed?: boolean;
    availableAt?: Date;
    expiresAt?: Date;
    reason?: string;
  }> {
    const existing = await this.reviewModel.exists({
      reviewer: reviewerId,
      announcement: announcementId,
    });
    if (existing) return { eligible: false, alreadyReviewed: true };

    const now = new Date();

    try {
      const { availableAt, expiresAt } = await this.getReviewWindow(
        reviewerId,
        announcementId,
        announcementModel,
      );

      if (now < availableAt)
        return { eligible: false, availableAt, expiresAt, reason: 'not_yet' };
      if (now > expiresAt)
        return { eligible: false, availableAt, expiresAt, reason: 'expired' };

      return { eligible: true, availableAt, expiresAt };
    } catch (e) {
      return { eligible: false, reason: e.message };
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────

  private async getReviewWindow(
    reviewerId: string,
    announcementId: string,
    announcementModel: 'Bid' | 'DirectSale' | 'Tender',
  ): Promise<{ availableAt: Date; expiresAt: Date }> {
    if (announcementModel === 'Bid') {
      const bid = await this.bidModel
        .findById(announcementId)
        .select('winner reviewAvailableAt')
        .lean();
      if (!bid) throw new NotFoundException('Enchère introuvable');
      if (!bid.winner || bid.winner.toString() !== reviewerId)
        throw new ForbiddenException("Seul le gagnant de l'enchère peut laisser un avis");
      if (!bid.reviewAvailableAt)
        throw new ForbiddenException("L'enchère n'est pas encore terminée");

      const expiresAt = new Date(
        new Date(bid.reviewAvailableAt).getTime() + REVIEW_WINDOW_DAYS * ONE_DAY_MS,
      );
      return { availableAt: bid.reviewAvailableAt, expiresAt };
    }

    if (announcementModel === 'Tender') {
      const tender = await this.tenderModel
        .findById(announcementId)
        .select('awardedTo reviewAvailableAt')
        .lean();
      if (!tender) throw new NotFoundException("Appel d'offre introuvable");
      if (!tender.awardedTo || tender.awardedTo.toString() !== reviewerId)
        throw new ForbiddenException("Seul l'adjudicataire peut laisser un avis");
      if (!tender.reviewAvailableAt)
        throw new ForbiddenException("L'appel d'offre n'est pas encore attribué");

      const expiresAt = new Date(
        new Date(tender.reviewAvailableAt).getTime() + REVIEW_WINDOW_DAYS * ONE_DAY_MS,
      );
      return { availableAt: tender.reviewAvailableAt, expiresAt };
    }

    // DirectSale
    const purchase = await this.purchaseModel
      .findOne({
        directSale: announcementId,
        buyer: reviewerId,
        status: { $in: [PURCHASE_STATUS.CONFIRMED, PURCHASE_STATUS.COMPLETED] },
      })
      .select('reviewAvailableAt')
      .lean();

    if (!purchase)
      throw new ForbiddenException(
        "Vous devez confirmer l'achat avant de laisser un avis",
      );
    if (!purchase.reviewAvailableAt)
      throw new ForbiddenException("La commande n'est pas encore confirmée");

    const expiresAt = new Date(
      new Date(purchase.reviewAvailableAt).getTime() + REVIEW_WINDOW_DAYS * ONE_DAY_MS,
    );
    return { availableAt: purchase.reviewAvailableAt, expiresAt };
  }

  private async checkEligibility(
    reviewerId: string,
    announcementId: string,
    announcementModel: 'Bid' | 'DirectSale' | 'Tender',
  ) {
    const now = new Date();
    const { availableAt, expiresAt } = await this.getReviewWindow(
      reviewerId,
      announcementId,
      announcementModel,
    );

    if (now < availableAt)
      throw new ForbiddenException(
        "L'avis sera disponible 24h après la fin de la transaction",
      );
    if (now > expiresAt)
      throw new ForbiddenException(
        "La fenêtre d'avis a expiré (30 jours après la transaction)",
      );
  }

  private async getSellerFromAnnouncement(
    id: string,
    model: string,
  ): Promise<Types.ObjectId> {
    const map: Record<string, Model<any>> = {
      Bid: this.bidModel,
      DirectSale: this.directSaleModel,
      Tender: this.tenderModel,
    };
    const doc = await map[model].findById(id).select('owner').lean() as any;
    if (!doc) throw new NotFoundException('Annonce introuvable');
    return doc.owner;
  }

  private async recalculateAnnouncementRating(
    announcementId: string,
    announcementModel: string,
  ) {
    const [agg] = await this.reviewModel.aggregate([
      { $match: { announcement: new Types.ObjectId(announcementId) } },
      {
        $group: {
          _id: null,
          avg: { $avg: '$stars' },
          count: { $sum: 1 },
          sum: { $sum: '$stars' },
        },
      },
    ]);

    const avg = agg ? parseFloat(agg.avg.toFixed(2)) : 0;
    const count = agg?.count ?? 0;
    const sum = agg?.sum ?? 0;
    const percent = parseFloat(((avg / 5) * 100).toFixed(2));

    const map: Record<string, Model<any>> = {
      Bid: this.bidModel,
      DirectSale: this.directSaleModel,
      Tender: this.tenderModel,
    };
    await map[announcementModel].findByIdAndUpdate(announcementId, {
      ratingAvg: avg,
      ratingCount: count,
      ratingSum: sum,
      ratingPercent: percent,
    });
  }

  private async recalculateUserScore(sellerId: string) {
    const [bids, sales, tenders] = await Promise.all([
      this.bidModel.find({ owner: sellerId }).select('ratingPercent').lean(),
      this.directSaleModel.find({ owner: sellerId }).select('ratingPercent').lean(),
      this.tenderModel.find({ owner: sellerId }).select('ratingPercent').lean(),
    ]);

    const all = [...bids, ...sales, ...tenders].map((d) => d.ratingPercent ?? 0);
    const score = all.length
      ? parseFloat((all.reduce((a, b) => a + b, 0) / all.length).toFixed(2))
      : 0;

    await this.userModel.findByIdAndUpdate(sellerId, { score });
  }
}
