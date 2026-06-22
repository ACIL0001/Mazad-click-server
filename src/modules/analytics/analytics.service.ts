import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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
import {
  AnalyticsHeatmap,
  AnalyticsHeatmapDocument,
} from './schemas/analytics-heatmap.schema';
import {
  IngestEventsDto,
  StartSessionDto,
  EndSessionDto,
  IngestHeatmapDto,
} from './dto/ingest-event.dto';
import { QueryAnalyticsDto } from './dto/query-analytics.dto';
import { maskIpAddress } from './utils/ip-masker';
import { parseUserAgent } from './utils/ua-parser';
import { resolveWilaya } from './utils/wilaya-mapper';
import { SocketGateway } from '../../socket/socket.gateway';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectModel(AnalyticsSession.name)
    private sessionModel: Model<AnalyticsSessionDocument>,
    @InjectModel(AnalyticsEvent.name)
    private eventModel: Model<AnalyticsEventDocument>,
    @InjectModel(AnalyticsSummary.name)
    private summaryModel: Model<AnalyticsSummaryDocument>,
    @InjectModel(AnalyticsHeatmap.name)
    private heatmapModel: Model<AnalyticsHeatmapDocument>,
    private readonly socketGateway: SocketGateway,
  ) {}

  // ═══════════════════════════════════════════
  // ██  INGESTION PIPELINE
  // ═══════════════════════════════════════════

  async startSession(
    dto: StartSessionDto,
    ip: string,
    userAgent: string,
    userId?: string,
    userType?: string,
    userWilaya?: string,
  ): Promise<{ ok: boolean }> {
    const maskedIp = maskIpAddress(ip);
    const ua = parseUserAgent(userAgent);
    const wilaya = resolveWilaya(userWilaya);

    // Upsert to handle duplicate session starts
    await this.sessionModel.updateOne(
      { sessionId: dto.sessionId },
      {
        $setOnInsert: {
          sessionId: dto.sessionId,
          userId: userId ? new Types.ObjectId(userId) : null,
          userType: userType || 'guest',
          ipMasked: maskedIp,
          country: 'Algeria',
          wilaya,
          deviceType: ua.deviceType,
          browser: ua.browser,
          os: ua.os,
          screenResolution: dto.screenResolution || '',
          referrer: dto.referrer || '',
          landingPage: dto.landingPage || '',
          utm: dto.utm || {},
          durationSeconds: 0,
          pageCount: 1,
          isBounce: true,
        },
      },
      { upsert: true },
    );

    this.broadcastRealtimeUpdate();

    return { ok: true };
  }

  async endSession(dto: EndSessionDto): Promise<{ ok: boolean }> {
    await this.sessionModel.updateOne(
      { sessionId: dto.sessionId },
      {
        $set: {
          durationSeconds: dto.durationSeconds || 0,
          pageCount: dto.pageCount || 1,
          isBounce: (dto.pageCount || 1) <= 1,
          exitPage: dto.exitPage || '',
          endedAt: new Date(),
        },
      },
    );
    return { ok: true };
  }

  async ingestEvents(
    dto: IngestEventsDto,
    userId?: string,
  ): Promise<{ ingested: number }> {
    if (!dto.events || dto.events.length === 0) {
      return { ingested: 0 };
    }

    const docs = dto.events.map((event) => {
      // Sanitize numerical properties if they are sent as strings
      const props = { ...(event.properties || {}) };
      if (typeof props.bidAmount === 'string') props.bidAmount = Number(props.bidAmount) || 0;
      if (typeof props.price === 'string') props.price = Number(props.price) || 0;
      if (typeof props.offerAmount === 'string') props.offerAmount = Number(props.offerAmount) || 0;
      if (typeof props.resultsCount === 'string') props.resultsCount = Number(props.resultsCount) || 0;

      return {
        sessionId: dto.sessionId,
        userId: userId ? new Types.ObjectId(userId) : undefined,
        eventName: event.eventName,
        urlPath: event.urlPath,
        pageTitle: event.pageTitle || '',
        properties: props,
        elementSelector: event.elementSelector || '',
        position: event.position || undefined,
        referrer: event.referrer || '',
      };
    });

    try {
      const result = await this.eventModel.insertMany(docs, { ordered: false });

      // Update session page count if page_view events were ingested
      const pageViews = docs.filter((d) => d.eventName === 'page_view').length;
      if (pageViews > 0) {
        await this.sessionModel.updateOne(
          { sessionId: dto.sessionId },
          {
            $inc: { pageCount: pageViews },
            $set: { isBounce: false },
          },
        );
        this.broadcastRealtimeUpdate();
      }

      return { ingested: result.length };
    } catch (error) {
      this.logger.error('Failed to ingest events', error);
      return { ingested: 0 };
    }
  }

  async ingestHeatmap(
    dto: IngestHeatmapDto,
  ): Promise<{ ingested: number }> {
    if (!dto.interactions || dto.interactions.length === 0) {
      return { ingested: 0 };
    }

    const docs = dto.interactions.map((interaction) => ({
      urlPath: interaction.urlPath,
      sessionId: dto.sessionId,
      interactionType: interaction.interactionType,
      position: interaction.position,
      elementSelector: interaction.elementSelector || '',
      viewportWidth: interaction.viewportWidth,
      viewportHeight: interaction.viewportHeight,
      scrollDepth: interaction.scrollDepth,
    }));

    try {
      const result = await this.heatmapModel.insertMany(docs, {
        ordered: false,
      });
      return { ingested: result.length };
    } catch (error) {
      this.logger.error('Failed to ingest heatmap data', error);
      return { ingested: 0 };
    }
  }

  // ═══════════════════════════════════════════
  // ██  DASHBOARD: OVERVIEW
  // ═══════════════════════════════════════════

  async getOverview(query: QueryAnalyticsDto) {
    const { from, to } = this.resolveDateRange(query);

    const [
      sessionStats,
      topEvents,
      deviceStats,
      sourceStats,
    ] = await Promise.all([
      this.getSessionMetrics(from, to),
      this.getTopEvents(from, to, 10),
      this.getDeviceBreakdown(from, to),
      this.getSourceBreakdown(from, to),
    ]);

    return {
      ...sessionStats,
      topEvents,
      deviceBreakdown: deviceStats,
      sourceBreakdown: sourceStats,
      dateRange: { from, to },
    };
  }

  private async getSessionMetrics(from: Date, to: Date) {
    const pipeline = await this.sessionModel.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          uniqueVisitors: { $addToSet: { $ifNull: ['$userId', '$sessionId'] } },
          totalDuration: { $sum: '$durationSeconds' },
          totalPages: { $sum: '$pageCount' },
          bounceCount: {
            $sum: { $cond: ['$isBounce', 1, 0] },
          },
        },
      },
    ]);

    const stats = pipeline[0] || {
      totalSessions: 0,
      uniqueVisitors: [],
      totalDuration: 0,
      totalPages: 0,
      bounceCount: 0,
    };

    const totalSessions = stats.totalSessions || 0;

    // Page views from events
    const pageViews = await this.eventModel.countDocuments({
      eventName: 'page_view',
      createdAt: { $gte: from, $lte: to },
    });

    return {
      totalSessions,
      uniqueVisitors: Array.isArray(stats.uniqueVisitors)
        ? stats.uniqueVisitors.length
        : 0,
      pageViews,
      bounceRate:
        totalSessions > 0
          ? Math.round((stats.bounceCount / totalSessions) * 100 * 10) / 10
          : 0,
      avgSessionDuration:
        totalSessions > 0
          ? Math.round(stats.totalDuration / totalSessions)
          : 0,
      avgPagesPerSession:
        totalSessions > 0
          ? Math.round((stats.totalPages / totalSessions) * 10) / 10
          : 0,
    };
  }

  private async getTopEvents(from: Date, to: Date, limit: number) {
    return this.eventModel.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          eventName: { $nin: ['page_view', 'page_exit'] },
        },
      },
      { $group: { _id: '$eventName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      { $project: { eventName: '$_id', count: 1, _id: 0 } },
    ]);
  }

  private async getDeviceBreakdown(from: Date, to: Date) {
    const results = await this.sessionModel.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: '$deviceType', count: { $sum: 1 } } },
    ]);
    const breakdown = { desktop: 0, mobile: 0, tablet: 0 };
    results.forEach((r) => {
      if (r._id in breakdown) breakdown[r._id] = r.count;
    });
    return breakdown;
  }

  private async getSourceBreakdown(from: Date, to: Date) {
    const results = await this.sessionModel.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $addFields: {
          source: {
            $switch: {
              branches: [
                { case: { $ne: ['$utm.source', ''] }, then: '$utm.medium' },
                {
                  case: {
                    $regexMatch: {
                      input: { $ifNull: ['$referrer', ''] },
                      regex: /google|bing|yahoo|duckduckgo/i,
                    },
                  },
                  then: 'organic',
                },
                {
                  case: {
                    $regexMatch: {
                      input: { $ifNull: ['$referrer', ''] },
                      regex: /facebook|twitter|instagram|linkedin|tiktok/i,
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

    const breakdown = {
      direct: 0,
      organic: 0,
      social: 0,
      referral: 0,
      paid: 0,
      email: 0,
    };
    results.forEach((r) => {
      const key = r._id || 'direct';
      if (key in breakdown) breakdown[key] = r.count;
      else if (key === 'cpc' || key === 'ppc') breakdown.paid = r.count;
    });
    return breakdown;
  }

  // ═══════════════════════════════════════════
  // ██  DASHBOARD: TRAFFIC TRENDS
  // ═══════════════════════════════════════════

  async getTraffic(query: QueryAnalyticsDto) {
    const { from, to } = this.resolveDateRange(query);
    const granularity = query.granularity || 'daily';

    const [trend, topLandingPages, topReferrers] = await Promise.all([
      this.getSessionTrend(from, to, granularity),
      this.getTopLandingPages(from, to),
      this.getTopReferrers(from, to),
    ]);

    return { trend, topLandingPages, topReferrers, dateRange: { from, to } };
  }

  private async getSessionTrend(
    from: Date,
    to: Date,
    granularity: string,
  ) {
    const groupId =
      granularity === 'hourly'
        ? {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
            hour: { $hour: '$createdAt' },
          }
        : {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          };

    return this.sessionModel.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: groupId,
          sessions: { $sum: 1 },
          uniqueUsers: {
            $addToSet: { $ifNull: ['$userId', '$sessionId'] },
          },
          bounces: { $sum: { $cond: ['$isBounce', 1, 0] } },
        },
      },
      {
        $project: {
          _id: 1,
          sessions: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          bounces: 1,
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } },
    ]);
  }

  private async getTopLandingPages(from: Date, to: Date) {
    return this.sessionModel.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to }, landingPage: { $ne: '' } } },
      { $group: { _id: '$landingPage', sessions: { $sum: 1 } } },
      { $sort: { sessions: -1 } },
      { $limit: 10 },
      { $project: { page: '$_id', sessions: 1, _id: 0 } },
    ]);
  }

  private async getTopReferrers(from: Date, to: Date) {
    return this.sessionModel.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          referrer: { $ne: '', $exists: true },
        },
      },
      { $group: { _id: '$referrer', sessions: { $sum: 1 } } },
      { $sort: { sessions: -1 } },
      { $limit: 10 },
      { $project: { referrer: '$_id', sessions: 1, _id: 0 } },
    ]);
  }

  // ═══════════════════════════════════════════
  // ██  DASHBOARD: GEOGRAPHIC
  // ═══════════════════════════════════════════

  async getGeographic(query: QueryAnalyticsDto) {
    const { from, to } = this.resolveDateRange(query);

    const wilayaData = await this.sessionModel.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          wilaya: { $ne: 'Unknown', $exists: true },
          userType: { $ne: 'guest' },
        },
      },
      {
        $group: {
          _id: '$wilaya',
          sessions: { $sum: 1 },
          uniqueVisitors: { $addToSet: { $ifNull: ['$userId', '$sessionId'] } },
          avgDuration: { $avg: '$durationSeconds' },
          bounces: { $sum: { $cond: ['$isBounce', 1, 0] } },
        },
      },
      {
        $project: {
          wilaya: '$_id',
          sessions: 1,
          uniqueVisitors: { $size: '$uniqueVisitors' },
          avgDuration: { $round: ['$avgDuration', 0] },
          bounceRate: {
            $round: [
              {
                $multiply: [
                  { $divide: ['$bounces', { $max: ['$sessions', 1] }] },
                  100,
                ],
              },
              1,
            ],
          },
          _id: 0,
        },
      },
      { $sort: { sessions: -1 } },
    ]);

    return { wilayas: wilayaData, dateRange: { from, to } };
  }

  // ═══════════════════════════════════════════
  // ██  DASHBOARD: CONVERSION FUNNELS
  // ═══════════════════════════════════════════

  async getFunnels(query: QueryAnalyticsDto) {
    const { from, to } = this.resolveDateRange(query);

    const [auctionFunnel, tenderFunnel, directSalesFunnel] =
      await Promise.all([
        this.buildFunnel(from, to, [
          { eventName: 'page_view', urlPath: { $regex: /^\/(auctions|category)/i } },
          { eventName: 'page_view', urlPath: { $regex: /^\/auction(\/|$)/i } },
          { eventName: 'bid_placed' },
          { eventName: 'bid_won' },
        ]),
        this.buildFunnel(from, to, [
          { eventName: 'page_view', urlPath: { $regex: /^\/tenders/i } },
          { eventName: 'page_view', urlPath: { $regex: /^\/tender-details/i } },
          { eventName: 'cahier_downloaded' },
          { eventName: 'tender_offer_submitted' },
        ]),
        this.buildFunnel(from, to, [
          { eventName: 'page_view', urlPath: { $regex: /^\/direct-sale(\/|$)/i } },
          { eventName: 'page_view', urlPath: { $regex: /^\/direct-sale\/.+/i } },
          { eventName: 'ds_purchase_completed' },
        ]),
      ]);

    return {
      auctionFunnel: this.formatFunnel(auctionFunnel, [
        'List View',
        'Detail View',
        'Bid Placed',
        'Bid Won',
      ]),
      tenderFunnel: this.formatFunnel(tenderFunnel, [
        'List View',
        'Detail View',
        'Cahier Downloaded',
        'Bid Submitted',
      ]),
      directSalesFunnel: this.formatFunnel(directSalesFunnel, [
        'List View',
        'Detail View',
        'Purchase Completed',
      ]),
      dateRange: { from, to },
    };
  }

  private async buildFunnel(from: Date, to: Date, steps: any[]) {
    const counts = await Promise.all(
      steps.map((query) =>
        this.eventModel
          .distinct('sessionId', {
            ...query,
            createdAt: { $gte: from, $lte: to },
          })
          .then((ids) => ids.length),
      ),
    );
    return counts;
  }

  private formatFunnel(counts: number[], labels: string[]) {
    return labels.map((label, i) => ({
      step: label,
      count: counts[i] || 0,
      dropoff:
        i > 0 && counts[i - 1] > 0
          ? Math.round(
              ((counts[i - 1] - counts[i]) / counts[i - 1]) * 100 * 10,
            ) / 10
          : 0,
      conversionFromPrevious:
        i > 0 && counts[i - 1] > 0
          ? Math.round((counts[i] / counts[i - 1]) * 100 * 10) / 10
          : 100,
    }));
  }

  // ═══════════════════════════════════════════
  // ██  DASHBOARD: USER JOURNEYS (Sankey)
  // ═══════════════════════════════════════════

  async getJourneys(query: QueryAnalyticsDto) {
    const { from, to } = this.resolveDateRange(query);

    // Get page transitions within sessions
    const transitions = await this.eventModel.aggregate([
      {
        $match: {
          eventName: 'page_view',
          createdAt: { $gte: from, $lte: to },
        },
      },
      { $sort: { sessionId: 1, createdAt: 1 } },
      {
        $group: {
          _id: '$sessionId',
          pages: { $push: '$urlPath' },
        },
      },
      { $match: { 'pages.1': { $exists: true } } }, // At least 2 pages
    ]);

    // Build transition map
    const transitionMap = new Map<string, number>();
    for (const session of transitions) {
      const pages: string[] = session.pages;
      
      // 1. Clean consecutive duplicates
      const cleanPages: string[] = [];
      let lastPage = '';
      for (const p of pages) {
        const normalized = this.normalizePath(p);
        if (normalized !== lastPage) {
          cleanPages.push(normalized);
          lastPage = normalized;
        }
      }

      // 2. Build DAG transitions (max 6 steps to keep Sankey clean)
      for (let i = 0; i < cleanPages.length - 1 && i < 6; i++) {
        const fromPage = `[Step ${i + 1}] ${cleanPages[i]}`;
        const toPage = `[Step ${i + 2}] ${cleanPages[i + 1]}`;
        const key = `${fromPage}|||${toPage}`;
        transitionMap.set(key, (transitionMap.get(key) || 0) + 1);
      }
    }

    // Convert to Sankey-compatible format
    const nodesSet = new Set<string>();
    const links: { source: string; target: string; value: number }[] = [];

    const sortedTransitions = Array.from(transitionMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50);

    for (const [key, value] of sortedTransitions) {
      const [source, target] = key.split('|||');
      nodesSet.add(source);
      nodesSet.add(target);
      links.push({ source, target, value });
    }

    return {
      nodes: Array.from(nodesSet).map((id) => ({ id })),
      links,
      totalSessions: transitions.length,
      dateRange: { from, to },
    };
  }

  private normalizePath(path: string): string {
    // Normalize dynamic segments: /auction-details/65f2a1b9... → /auction-details/:id
    return path
      .replace(/\/[a-f0-9]{24}/g, '/:id')
      .replace(/\/\d+/g, '/:id')
      .replace(/\?.*$/, ''); // Strip query params
  }

  // ═══════════════════════════════════════════
  // ██  DASHBOARD: HEATMAPS
  // ═══════════════════════════════════════════

  async getHeatmaps(query: QueryAnalyticsDto) {
    const { from, to } = this.resolveDateRange(query);
    const urlPath = query.urlPath || '/';

    const [clicks, rageClicks, deadClicks, scrollData] = await Promise.all([
      this.heatmapModel
        .find({
          urlPath,
          interactionType: 'click',
          createdAt: { $gte: from, $lte: to },
        })
        .select('position elementSelector viewportWidth viewportHeight')
        .limit(5000)
        .lean(),
      this.heatmapModel
        .find({
          urlPath,
          interactionType: 'rage_click',
          createdAt: { $gte: from, $lte: to },
        })
        .select('position elementSelector')
        .limit(1000)
        .lean(),
      this.heatmapModel
        .find({
          urlPath,
          interactionType: 'dead_click',
          createdAt: { $gte: from, $lte: to },
        })
        .select('position elementSelector')
        .limit(1000)
        .lean(),
      this.heatmapModel.aggregate([
        {
          $match: {
            urlPath,
            interactionType: 'scroll',
            createdAt: { $gte: from, $lte: to },
          },
        },
        {
          $group: {
            _id: {
              $multiply: [{ $floor: { $divide: ['$scrollDepth', 10] } }, 10],
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    return {
      urlPath,
      clicks,
      rageClicks,
      deadClicks,
      scrollDepthDistribution: scrollData.map((s) => ({
        depth: s._id,
        count: s.count,
      })),
      dateRange: { from, to },
    };
  }

  // ═══════════════════════════════════════════
  // ██  DASHBOARD: SEARCH ANALYTICS
  // ═══════════════════════════════════════════

  async getSearchAnalytics(query: QueryAnalyticsDto) {
    const { from, to } = this.resolveDateRange(query);

    const [topSearches, zeroResults, searchTrend] = await Promise.all([
      this.eventModel.aggregate([
        {
          $match: {
            eventName: 'search_performed',
            createdAt: { $gte: from, $lte: to },
          },
        },
        {
          $group: {
            _id: '$properties.query',
            count: { $sum: 1 },
            avgResults: { $avg: '$properties.resultsCount' },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 20 },
        {
          $project: {
            query: '$_id',
            count: 1,
            avgResults: { $round: ['$avgResults', 0] },
            _id: 0,
          },
        },
      ]),
      this.eventModel.aggregate([
        {
          $match: {
            eventName: 'search_performed',
            'properties.resultsCount': 0,
            createdAt: { $gte: from, $lte: to },
          },
        },
        { $group: { _id: '$properties.query', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
        { $project: { query: '$_id', count: 1, _id: 0 } },
      ]),
      this.eventModel.aggregate([
        {
          $match: {
            eventName: 'search_performed',
            createdAt: { $gte: from, $lte: to },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ]),
    ]);

    // Calculate search-to-click-through rate
    const [totalSearches, searchClicks] = await Promise.all([
      this.eventModel.countDocuments({
        eventName: 'search_performed',
        createdAt: { $gte: from, $lte: to },
      }),
      this.eventModel.countDocuments({
        eventName: 'search_result_clicked',
        createdAt: { $gte: from, $lte: to },
      }),
    ]);

    return {
      topSearches,
      zeroResults,
      searchTrend,
      totalSearches,
      clickThroughRate:
        totalSearches > 0
          ? Math.round((searchClicks / totalSearches) * 100 * 10) / 10
          : 0,
      dateRange: { from, to },
    };
  }

  // ═══════════════════════════════════════════
  // ██  DASHBOARD: E-COMMERCE
  // ═══════════════════════════════════════════

  async getEcommerce(query: QueryAnalyticsDto) {
    const { from, to } = this.resolveDateRange(query);

    const [bidsData, tendersData, directSalesData, subscriptionsData, transactionBreakdown] = await Promise.all([
      // Bids (Auctions)
      this.eventModel.aggregate([
        { $match: { eventName: 'bid_placed', createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: null, count: { $sum: 1 }, totalValue: { $sum: '$properties.bidAmount' }, avgValue: { $avg: '$properties.bidAmount' } } }
      ]),
      // Tenders (Soumission offers)
      this.eventModel.aggregate([
        { $match: { eventName: 'tender_offer_submitted', createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: null, count: { $sum: 1 }, totalValue: { $sum: '$properties.offerAmount' } } }
      ]),
      // Direct Sales
      this.eventModel.aggregate([
        { $match: { eventName: 'ds_purchase_completed', createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: null, count: { $sum: 1 }, totalValue: { $sum: '$properties.price' } } }
      ]),
      // Subscriptions
      this.eventModel.aggregate([
        { $match: { eventName: 'subscription_purchased', createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: null, count: { $sum: 1 }, totalValue: { $sum: '$properties.price' } } }
      ]),
      // Breakdown
      this.eventModel.aggregate([
        {
          $match: {
            eventName: { $in: ['bid_placed', 'tender_offer_submitted', 'ds_purchase_completed'] },
            createdAt: { $gte: from, $lte: to },
          },
        },
        {
          $group: {
            _id: { category: '$properties.category', type: '$eventName' },
            count: { $sum: 1 },
            totalValue: {
              $sum: {
                $ifNull: ['$properties.bidAmount', { $ifNull: ['$properties.price', { $ifNull: ['$properties.offerAmount', 0] }] }],
              },
            },
          },
        },
        {
          $project: {
            category: { $ifNull: ['$_id.category', 'Uncategorized'] },
            type: '$_id.type',
            count: 1,
            totalValue: 1,
            _id: 0,
          },
        },
        { $sort: { totalValue: -1 } }
      ])
    ]);

    return {
      bids: {
        count: bidsData[0]?.count || 0,
        totalValue: bidsData[0]?.totalValue || 0,
        avgValue: bidsData[0]?.avgValue || 0,
      },
      tenders: {
        count: tendersData[0]?.count || 0,
        totalValue: tendersData[0]?.totalValue || 0,
      },
      directSales: {
        count: directSalesData[0]?.count || 0,
        totalValue: directSalesData[0]?.totalValue || 0,
      },
      subscriptions: {
        count: subscriptionsData[0]?.count || 0,
        totalValue: subscriptionsData[0]?.totalValue || 0,
      },
      transactionBreakdown,
      dateRange: { from, to },
    };
  }

  // ═══════════════════════════════════════════
  // ██  DASHBOARD: USER PROFILES
  // ═══════════════════════════════════════════

  async getUserProfile(userId: string) {
    const userOid = new Types.ObjectId(userId);

    const [sessions, recentEvents, eventCounts] = await Promise.all([
      this.sessionModel
        .find({ userId: userOid })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      this.eventModel
        .find({ userId: userOid })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      this.eventModel.aggregate([
        { $match: { userId: userOid } },
        { $group: { _id: '$eventName', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    const totalSessions = sessions.length;
    const totalDuration = sessions.reduce(
      (sum, s) => sum + (s.durationSeconds || 0),
      0,
    );

    return {
      userId,
      totalSessions,
      totalDurationSeconds: totalDuration,
      avgSessionDuration:
        totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0,
      recentSessions: sessions.slice(0, 10),
      recentEvents: recentEvents.slice(0, 30),
      eventBreakdown: eventCounts.map((e) => ({
        event: e._id,
        count: e.count,
      })),
      firstSeen: sessions.length > 0 ? sessions[sessions.length - 1].createdAt : null,
      lastSeen: sessions.length > 0 ? sessions[0].createdAt : null,
    };
  }

  // ═══════════════════════════════════════════
  // ██  DASHBOARD: COHORTS
  // ═══════════════════════════════════════════

  async getCohorts(query: QueryAnalyticsDto) {
    const { from, to } = this.resolveDateRange(query);

    // Build weekly cohorts based on registration date
    const cohorts = await this.sessionModel.aggregate([
      {
        $match: {
          userId: { $ne: null },
          createdAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: {
            userId: '$userId',
            week: { $isoWeek: '$createdAt' },
            year: { $isoWeekYear: '$createdAt' },
          },
          sessionCount: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: { week: '$_id.week', year: '$_id.year' },
          activeUsers: { $sum: 1 },
          totalSessions: { $sum: '$sessionCount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.week': 1 } },
    ]);

    return { cohorts, dateRange: { from, to } };
  }

  // ═══════════════════════════════════════════
  // ██  DASHBOARD: REAL-TIME
  // ═══════════════════════════════════════════

  async getRealtime() {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const oneMinAgo = new Date(Date.now() - 60 * 1000);

    const [activeSessions, recentPageViews, activePages] = await Promise.all([
      this.sessionModel.countDocuments({
        createdAt: { $gte: fiveMinAgo },
        endedAt: { $exists: false },
      }),
      this.eventModel.countDocuments({
        eventName: 'page_view',
        createdAt: { $gte: oneMinAgo },
      }),
      this.eventModel.aggregate([
        {
          $match: {
            eventName: 'page_view',
            createdAt: { $gte: fiveMinAgo },
          },
        },
        { $group: { _id: '$urlPath', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { page: '$_id', viewers: '$count', _id: 0 } },
      ]),
    ]);

    return {
      activeUsers: activeSessions,
      pageViewsPerMinute: recentPageViews,
      activePages,
      timestamp: new Date(),
    };
  }

  private async broadcastRealtimeUpdate() {
    try {
      const data = await this.getRealtime();
      this.socketGateway.broadcastAnalyticsUpdate(data);
    } catch (err) {
      this.logger.error('Failed to broadcast realtime update', err);
    }
  }

  // ═══════════════════════════════════════════
  // ██  DASHBOARD: EVENTS EXPLORER
  // ═══════════════════════════════════════════

  async getEvents(query: QueryAnalyticsDto & { page?: number; limit?: number }) {
    const { from, to } = this.resolveDateRange(query);
    const page = query.page || 1;
    const limit = Math.min(query.limit || 50, 100);
    const skip = (page - 1) * limit;

    const filter: any = { createdAt: { $gte: from, $lte: to } };
    if (query.eventName) filter.eventName = query.eventName;
    if (query.urlPath) filter.urlPath = { $regex: query.urlPath, $options: 'i' };

    const [events, total] = await Promise.all([
      this.eventModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.eventModel.countDocuments(filter),
    ]);

    return {
      events,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      dateRange: { from, to },
    };
  }

  // ═══════════════════════════════════════════
  // ██  UTILITIES
  // ═══════════════════════════════════════════

  private resolveDateRange(query: QueryAnalyticsDto): {
    from: Date;
    to: Date;
  } {
    const to = query.to ? new Date(query.to + 'T23:59:59.999Z') : new Date();
    const from = query.from
      ? new Date(query.from + 'T00:00:00.000Z')
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
    return { from, to };
  }
}
