import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Bid, BidDocument, BID_STATUS } from './schema/bid.schema';
import { Offer, OfferDocument } from './schema/offer.schema';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/schema/notification.schema';

@Injectable()
export class AuctionNotificationService {
  private readonly logger = new Logger(AuctionNotificationService.name);

  constructor(
    @InjectModel(Bid.name) private bidModel: Model<BidDocument>,
    @InjectModel(Offer.name) private offerModel: Model<OfferDocument>,
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
