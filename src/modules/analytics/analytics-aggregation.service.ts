import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AnalyticsSession,
  AnalyticsSessionDocument,
} from './schemas/analytics-session.schema';
import {
  AnalyticsEvent,
  AnalyticsEventDocument,
} from './schemas/analytics-event.schema';
import {
  AnalyticsSummary,
  AnalyticsSummaryDocument,
} from './schemas/analytics-summary.schema';

@Injectable()
export class AnalyticsAggregationService {
  private readonly logger = new Logger(AnalyticsAggregationService.name);

  constructor(
    @InjectModel(AnalyticsSession.name)
    private sessionModel: Model<AnalyticsSessionDocument>,
    @InjectModel(AnalyticsEvent.name)
    private eventModel: Model<AnalyticsEventDocument>,
    @InjectModel(AnalyticsSummary.name)
    private summaryModel: Model<AnalyticsSummaryDocument>,
  ) {}

  /**
   * Run every hour to aggregate the previous hour's data.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async aggregateHourly() {
    try {
      const now = new Date();
      const hourStart = new Date(now);
      hourStart.setMinutes(0, 0, 0);
      const hourEnd = new Date(hourStart);
      hourEnd.setHours(hourEnd.getHours() + 1);

      // Move back 1 hour to aggregate the completed hour
      const prevHourStart = new Date(hourStart.getTime() - 3600000);
      const prevHourEnd = hourStart;

      const dateStr = prevHourStart.toISOString().split('T')[0];
      const hour = prevHourStart.getHours();

      await this.computeAndStoreSummary(
        prevHourStart,
        prevHourEnd,
        dateStr,
        'hourly',
        hour,
      );

      this.logger.log(
        `Hourly aggregation complete for ${dateStr} H${hour}`,
      );
    } catch (error) {
      this.logger.error('Hourly aggregation failed', error.stack);
    }
  }

  /**
   * Run daily at 2:00 AM to compute daily summaries.
   */
  @Cron('0 2 * * *')
  async aggregateDaily() {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      const from = new Date(dateStr + 'T00:00:00.000Z');
      const to = new Date(dateStr + 'T23:59:59.999Z');

      await this.computeAndStoreSummary(from, to, dateStr, 'daily');

      this.logger.log(`Daily aggregation complete for ${dateStr}`);
    } catch (error) {
      this.logger.error('Daily aggregation failed', error.stack);
    }
  }

  /**
   * Run daily at 3:00 AM to clean up orphaned sessions (no endedAt, older than 24h).
   */
  @Cron('0 3 * * *')
  async cleanupOrphanedSessions() {
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const result = await this.sessionModel.updateMany(
        {
          endedAt: { $exists: false },
          createdAt: { $lt: cutoff },
        },
        {
          $set: {
            endedAt: cutoff,
            isBounce: true,
          },
        },
      );
      this.logger.log(
        `Cleaned up ${result.modifiedCount} orphaned sessions`,
      );
    } catch (error) {
      this.logger.error('Session cleanup failed', error.stack);
    }
  }

  /**
   * Core aggregation logic shared by hourly and daily jobs.
   */
  private async computeAndStoreSummary(
    from: Date,
    to: Date,
    dateStr: string,
    granularity: 'hourly' | 'daily',
    hour?: number,
  ) {
    // ── Session Metrics ──
    const sessionAgg = await this.sessionModel.aggregate([
      { $match: { createdAt: { $gte: from, $lt: to } } },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          uniqueVisitors: {
            $addToSet: { $ifNull: ['$userId', '$sessionId'] },
          },
          totalDuration: { $sum: '$durationSeconds' },
          totalPages: { $sum: '$pageCount' },
          bounceCount: { $sum: { $cond: ['$isBounce', 1, 0] } },
        },
      },
    ]);

    const ss = sessionAgg[0] || {
      totalSessions: 0,
      uniqueVisitors: [],
      totalDuration: 0,
      totalPages: 0,
      bounceCount: 0,
    };

    // ── Device Breakdown ──
    const deviceAgg = await this.sessionModel.aggregate([
      { $match: { createdAt: { $gte: from, $lt: to } } },
      { $group: { _id: '$deviceType', count: { $sum: 1 } } },
    ]);
    const deviceBreakdown = { desktop: 0, mobile: 0, tablet: 0 };
    deviceAgg.forEach((d) => {
      if (d._id in deviceBreakdown) deviceBreakdown[d._id] = d.count;
    });

    // ── Source Breakdown ──
    const sourceAgg = await this.sessionModel.aggregate([
      { $match: { createdAt: { $gte: from, $lt: to } } },
      {
        $addFields: {
          source: {
            $switch: {
              branches: [
                {
                  case: {
                    $regexMatch: {
                      input: { $ifNull: ['$referrer', ''] },
                      regex: /google|bing|yahoo/i,
                    },
                  },
                  then: 'organic',
                },
                {
                  case: {
                    $regexMatch: {
                      input: { $ifNull: ['$referrer', ''] },
                      regex: /facebook|twitter|instagram|linkedin/i,
                    },
                  },
                  then: 'social',
                },
                {
                  case: {
                    $and: [
                      { $ne: ['$referrer', ''] },
                      { $ne: ['$referrer', null] },
                    ],
                  },
                  then: 'referral',
                },
              ],
              default: 'direct',
            },
          },
        },
      },
      { $group: { _id: '$source', count: { $sum: 1 } } },
    ]);
    const sourceBreakdown = {
      direct: 0,
      organic: 0,
      social: 0,
      referral: 0,
      paid: 0,
      email: 0,
    };
    sourceAgg.forEach((s) => {
      if (s._id in sourceBreakdown) sourceBreakdown[s._id] = s.count;
    });

    // ── Top Wilayas ──
    const wilayaAgg = await this.sessionModel.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lt: to },
          wilaya: { $ne: 'Unknown' },
        },
      },
      { $group: { _id: '$wilaya', sessions: { $sum: 1 } } },
      { $sort: { sessions: -1 } },
      { $limit: 10 },
      { $project: { wilaya: '$_id', sessions: 1, _id: 0 } },
    ]);

    // ── Event Counts ──
    const eventCounts = await this.eventModel.aggregate([
      { $match: { createdAt: { $gte: from, $lt: to } } },
      { $group: { _id: '$eventName', count: { $sum: 1 } } },
    ]);

    const eventMap = new Map<string, number>();
    eventCounts.forEach((e) => eventMap.set(e._id, e.count));

    const pageViews =
      (eventMap.get('page_view') || 0) + (eventMap.get('page_exit') || 0);

    // ── Revenue from bid_placed events ──
    const revenueAgg = await this.eventModel.aggregate([
      {
        $match: {
          eventName: { $in: ['bid_placed', 'ds_purchase_completed'] },
          createdAt: { $gte: from, $lt: to },
        },
      },
      {
        $group: {
          _id: null,
          totalGTV: {
            $sum: {
              $ifNull: [
                '$properties.bidAmount',
                { $ifNull: ['$properties.price', 0] },
              ],
            },
          },
          txCount: { $sum: 1 },
        },
      },
    ]);
    const rev = revenueAgg[0] || { totalGTV: 0, txCount: 0 };

    // ── Funnel snapshots ──
    const auctionFunnel = {
      listViews: eventMap.get('auction_list_view') || 0,
      detailViews: eventMap.get('auction_detail_view') || 0,
      bidClicks: eventMap.get('bid_placed') || 0,
      bidsPlaced: eventMap.get('bid_placed') || 0,
    };

    const tenderFunnel = {
      listViews: eventMap.get('tender_list_view') || 0,
      detailViews: eventMap.get('tender_detail_view') || 0,
      cahierDownloads: eventMap.get('cahier_downloaded') || 0,
      bidsSubmitted: eventMap.get('tender_bid_submitted') || 0,
    };

    // ── Upsert Summary ──
    const totalSessions = ss.totalSessions || 1;

    const filter: any = { date: dateStr, granularity };
    if (granularity === 'hourly') filter.hour = hour;

    await this.summaryModel.updateOne(
      filter,
      {
        $set: {
          date: dateStr,
          granularity,
          hour: granularity === 'hourly' ? hour : undefined,
          totalSessions: ss.totalSessions,
          uniqueVisitors: Array.isArray(ss.uniqueVisitors)
            ? ss.uniqueVisitors.length
            : 0,
          pageViews,
          bounceCount: ss.bounceCount,
          avgSessionDurationSec: Math.round(
            ss.totalDuration / totalSessions,
          ),
          avgPagesPerSession:
            Math.round((ss.totalPages / totalSessions) * 10) / 10,
          deviceBreakdown,
          sourceBreakdown,
          topWilayas: wilayaAgg,
          bidsPlaced: eventMap.get('bid_placed') || 0,
          auctionsCreated: eventMap.get('auction_created') || 0,
          tendersViewed: eventMap.get('tender_detail_view') || 0,
          cahiersDownloaded: eventMap.get('cahier_downloaded') || 0,
          directSalesInitiated: eventMap.get('ds_purchase_initiated') || 0,
          directSalesCompleted: eventMap.get('ds_purchase_completed') || 0,
          registrations: eventMap.get('register_completed') || 0,
          logins: eventMap.get('login_success') || 0,
          searchesPerformed: eventMap.get('search_performed') || 0,
          totalGTV: rev.totalGTV,
          averageOrderValue:
            rev.txCount > 0 ? Math.round(rev.totalGTV / rev.txCount) : 0,
          auctionFunnel,
          tenderFunnel,
        },
      },
      { upsert: true },
    );
  }
}
