import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Bid, BidDocument, BID_STATUS } from './schema/bid.schema';
import { Offer, OfferDocument } from './schema/offer.schema';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/schema/notification.schema';
import { Chat, ChatDocument } from '../chat/schema/chat.schema';

@Injectable()
export class AuctionNotificationService {
  private readonly logger = new Logger(AuctionNotificationService.name);

  constructor(
    @InjectModel(Bid.name) private bidModel: Model<BidDocument>,
    @InjectModel(Offer.name) private offerModel: Model<OfferDocument>,
    @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
    private notificationService: NotificationService,
  ) {
    this.logger.log('🚀 AuctionNotificationService initialized');
  }

  /**
   * Check for auctions in their last 5% of time and send notifications
   * Runs every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkAuctionsInLast5Percent() {
    // Only log every 5 minutes to reduce noise
    const now = new Date();
    const shouldLog = now.getMinutes() % 5 === 0;

    if (shouldLog) {
      this.logger.log('🔔 Checking for auctions in last 5% of time...');
    }

    try {
      // Find all active auctions
      const activeAuctions = await this.bidModel
        .find({
          status: { $in: [BID_STATUS.OPEN, BID_STATUS.ON_AUCTION] },
          startingAt: { $lte: now },
          endingAt: { $gt: now }
        })
        .populate('productCategory', 'name')
        .exec();

      if (shouldLog) {
        this.logger.log(`Found ${activeAuctions.length} active auctions`);
      }

      for (const auction of activeAuctions) {
        await this.checkAndNotifyAuctionLast5Percent(auction, now, shouldLog);
      }
    } catch (error) {
      this.logger.error('Error checking auctions in last 5%:', error);
    }
  }

  /**
   * Check if an auction is in its last 5% of time and send notifications
   */
  private async checkAndNotifyAuctionLast5Percent(auction: Bid, now: Date, shouldLog: boolean = false) {
    try {
      const totalDuration = auction.endingAt.getTime() - auction.startingAt.getTime();
      const elapsedTime = now.getTime() - auction.startingAt.getTime();
      const remainingTime = auction.endingAt.getTime() - now.getTime();

      // Calculate if we're in the last 5% of the auction
      const last5PercentTime = totalDuration * 0.05; // 5% of total duration
      const isInLast5Percent = remainingTime <= last5PercentTime && remainingTime > 0;

      if (shouldLog) {
        this.logger.log(`Auction ${auction._id} calculation:`);
        this.logger.log(`- Total duration: ${totalDuration}ms (${Math.round(totalDuration / (1000 * 60))} minutes)`);
        this.logger.log(`- Elapsed time: ${elapsedTime}ms (${Math.round(elapsedTime / (1000 * 60))} minutes)`);
        this.logger.log(`- Remaining time: ${remainingTime}ms (${Math.round(remainingTime / (1000 * 60))} minutes)`);
        this.logger.log(`- Last 5% threshold: ${last5PercentTime}ms (${Math.round(last5PercentTime / (1000 * 60))} minutes)`);
        this.logger.log(`- Is in last 5%: ${isInLast5Percent}`);
        this.logger.log(`- Notification already sent: ${auction.last5PercentNotificationSent}`);
      }

      if (!isInLast5Percent) {
        if (shouldLog) {
          this.logger.log(`Auction ${auction._id} is not in last 5%, skipping`);
        }
        return; // Not in last 5%, skip
      }

      // Check if we've already sent notification for this auction
      // We'll use a custom field in the auction document to track this
      if (auction.last5PercentNotificationSent) {
        if (shouldLog) {
          this.logger.log(`Notification already sent for auction ${auction._id}`);
        }
        return;
      }

      this.logger.log(`Auction ${auction._id} is in last 5% of time, sending notifications...`);

      // Get all participants (users who made offers) for this auction
      const offers = await this.offerModel
        .find({ bid: auction._id })
        .populate('user', 'firstName lastName email')
        .exec();

      this.logger.log(`Found ${offers.length} participants for auction ${auction._id}`);

      // Calculate remaining time in a readable format
      const remainingMinutes = Math.ceil(remainingTime / (1000 * 60));
      const remainingHours = Math.floor(remainingMinutes / 60);
      const remainingMins = remainingMinutes % 60;

      let timeRemainingText = '';
      if (remainingHours > 0) {
        timeRemainingText = `${remainingHours}h ${remainingMins}min`;
      } else {
        timeRemainingText = `${remainingMins}min`;
      }

      // Create notification for each participant
      const notificationTitle = '⏰ Enchère se termine bientôt !';
      const categoryName = auction.productCategory?.name || 'Inconnue';
      const notificationMessage = `L'enchère "${auction.title}" dans la catégorie ${categoryName} se termine dans ${timeRemainingText} ! Dépêchez-vous de faire votre dernière offre !`;

      let notificationsSent = 0;
      for (const offer of offers) {
        if (offer.user && offer.user._id) {
          try {
            await this.notificationService.create(
              offer.user._id.toString(),
              NotificationType.AUCTION_ENDING_SOON,
              notificationTitle,
              notificationMessage,
              auction,
            );
            notificationsSent++;
            this.logger.log(`Notification sent to participant ${offer.user._id} for auction ${auction._id}`);
          } catch (notificationError) {
            this.logger.error(`Error sending notification to participant ${offer.user._id}:`, notificationError);
          }
        }
      }

      // Mark that we've sent notifications for this auction
      await this.markNotificationSent(auction._id.toString());

      this.logger.log(`✅ Sent ${notificationsSent} notifications for auction ${auction._id} in last 5%`);
    } catch (error) {
      this.logger.error(`Error processing auction ${auction._id} for last 5% notification:`, error);
    }
  }

  /**
   * Mark that we've sent the last 5% notification for an auction
   */
  private async markNotificationSent(auctionId: string) {
    try {
      // Update the auction document to mark that we've sent the last 5% notification
      await this.bidModel.findByIdAndUpdate(
        auctionId,
        { last5PercentNotificationSent: true },
        { new: true }
      );
      this.logger.log(`Marked last 5% notification as sent for auction ${auctionId}`);
    } catch (error) {
      this.logger.error('Error marking notification as sent:', error);
    }
  }

  /**
   * Get auctions ending soon (for debugging/monitoring)
   */
  async getAuctionsEndingSoon(hours: number = 1) {
    const now = new Date();
    const endTime = new Date(now.getTime() + (hours * 60 * 60 * 1000));

    return this.bidModel
      .find({
        status: { $in: [BID_STATUS.OPEN, BID_STATUS.ON_AUCTION] },
        endingAt: { $gte: now, $lte: endTime }
      })
      .populate('productCategory', 'name')
      .exec();
  }

  /**
   * Manual trigger for testing notifications (for debugging)
   */
  async triggerNotificationCheck() {
    this.logger.log('🔧 Manual trigger: Checking for auctions in last 5% of time...');
    await this.checkAuctionsInLast5Percent();
  }

  /**
   * Get all active auctions with detailed timing info (for debugging)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkEndedAuctions() {
    const now = new Date();
    try {
      const endedAuctions = await this.bidModel
        .find({
          status: { $in: [BID_STATUS.OPEN, BID_STATUS.ON_AUCTION] },
          endingAt: { $lte: now },
          isSoldProcessed: { $ne: true }
        })
        .populate('owner')
        .populate('productCategory', 'name')
        .exec();

      if (endedAuctions.length > 0) {
        this.logger.log(`Found ${endedAuctions.length} ended auctions to process`);
      }

      for (const auction of endedAuctions) {
        await this.processEndedAuction(auction);
      }
    } catch (error) {
      this.logger.error('Error checking ended auctions:', error);
    }
  }

  private async processEndedAuction(auction: BidDocument) {
    try {
      // Find highest offer
      const winningOffer = await this.offerModel
        .findOne({ bid: auction._id })
        .sort({ price: -1 })
        .populate('user')
        .exec();

      if (winningOffer && winningOffer.user) {
        const winnerId = winningOffer.user._id.toString();
        const sellerId = auction.owner._id.toString();

        // Find existing chat
        let chat = await this.chatModel.findOne({
          $and: [
            { 'users._id': winnerId },
            { 'users._id': sellerId }
          ]
        });

        // 1. Notify Winner
        await this.notificationService.create(
          winnerId,
          NotificationType.AUCTION_WON,
          '🎉 Félicitations ! Vous avez remporté l\'enchère',
          `Vous avez remporté l'enchère "${auction.title}" avec une offre de ${winningOffer.price} DA.`,
          {
            auctionId: auction._id,
            price: winningOffer.price,
            amount: winningOffer.price,
            sellerId: sellerId,
            sellerName: `${auction.owner.firstName} ${auction.owner.lastName}`,
            chatAvailable: !!chat,
            chatId: chat ? chat._id : null,
            productTitle: auction.title
          },
          sellerId
        );

        // 2. Notify Owner
        await this.notificationService.create(
          auction.owner._id.toString(),
          NotificationType.ITEM_SOLD,
          '📦 Votre article a été vendu !',
          `Votre enchère "${auction.title}" s'est terminée avec une offre de ${winningOffer.price} DA.`,
          { auctionId: auction._id, price: winningOffer.price, amount: winningOffer.price, buyerId: winnerId },
          winnerId
        );

        // 3. Notify Losers
        const otherOffers = await this.offerModel
          .find({ bid: auction._id, user: { $ne: winningOffer.user._id } })
          .distinct('user');

        for (const userId of otherOffers) {
          await this.notificationService.create(
            userId.toString(),
            NotificationType.AUCTION_LOST,
            'Enchère terminée',
            `L'enchère "${auction.title}" est terminée.`,
            { auctionId: auction._id }
          );
        }

        // Update Auction
        auction.winner = winningOffer.user;
        auction.status = BID_STATUS.CLOSED; // Or whatever closed status you use
        auction.isSoldProcessed = true;

        // Set feedback timer for 30 mins later
        const feedbackTime = new Date();
        feedbackTime.setMinutes(feedbackTime.getMinutes() + 30);
        auction.feedbackAvailableAt = feedbackTime;
        auction.feedbackNotificationSent = false;

        await auction.save();
        this.logger.log(`Processed won auction ${auction._id}. Winner: ${winnerId}`);

      } else {
        // No bids
        auction.status = BID_STATUS.CLOSED;
        auction.isSoldProcessed = true;
        await auction.save();

        // Notify owner
        await this.notificationService.create(
          auction.owner._id.toString(),
          NotificationType.BID_ENDED,
          'Enchère terminée sans offres',
          `Votre enchère "${auction.title}" s'est terminée sans aucune offre.`,
          { auctionId: auction._id }
        );
        this.logger.log(`Processed empty auction ${auction._id}`);
      }

    } catch (error) {
      this.logger.error(`Error processing ended auction ${auction._id}:`, error);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkFeedbackReminders() {
    const now = new Date();
    try {
      const auctionsNeedingFeedback = await this.bidModel.find({
        feedbackAvailableAt: { $lte: now },
        feedbackNotificationSent: false,
        winner: { $exists: true }, // Ensure there is a winner
        isSoldProcessed: true,
        feedbackAction: { $exists: false }
      }).populate('winner').populate('productCategory', 'name').exec();

      if (auctionsNeedingFeedback.length > 0) {
        this.logger.log(`Found ${auctionsNeedingFeedback.length} auctions needing feedback reminder`);
      }

      for (const auction of auctionsNeedingFeedback) {
        if (auction.winner) {
          await this.notificationService.create(
            auction.winner._id.toString(),
            NotificationType.FEEDBACK_REMINDER,
            'Avis sur votre achat',
            `Comment s'est passée votre transaction pour "${auction.title}" ? Donnez votre avis !`,
            { auctionId: auction._id },
            auction.owner.toString()
          );

          auction.feedbackNotificationSent = true;
          await auction.save();
          this.logger.log(`Sent feedback reminder for auction ${auction._id}`);
        }
      }

    } catch (error) {
      this.logger.error('Error checking feedback reminders:', error);
    }
  }

  /**
   * Get all active auctions with detailed timing info (for debugging)
   */
  async getActiveAuctionsWithTiming() {
    const now = new Date();

    const activeAuctions = await this.bidModel
      .find({
        status: { $in: [BID_STATUS.OPEN, BID_STATUS.ON_AUCTION] },
        startingAt: { $lte: now },
        endingAt: { $gt: now }
      })
      .populate('productCategory', 'name')
      .exec();

    return activeAuctions.map(auction => {
      const totalDuration = auction.endingAt.getTime() - auction.startingAt.getTime();
      const remainingTime = auction.endingAt.getTime() - now.getTime();
      const last5PercentTime = totalDuration * 0.05;
      const isInLast5Percent = remainingTime <= last5PercentTime && remainingTime > 0;

      return {
        _id: auction._id,
        title: auction.title,
        startingAt: auction.startingAt,
        endingAt: auction.endingAt,
        totalDurationMinutes: Math.round(totalDuration / (1000 * 60)),
        remainingMinutes: Math.round(remainingTime / (1000 * 60)),
        last5PercentMinutes: Math.round(last5PercentTime / (1000 * 60)),
        isInLast5Percent,
        last5PercentNotificationSent: auction.last5PercentNotificationSent,
        status: auction.status
      };
    });
  }
}
