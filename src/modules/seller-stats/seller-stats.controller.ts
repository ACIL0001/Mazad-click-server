import { Controller, Get, Post, Query, UseGuards, Request, Body, Param, UnauthorizedException } from '@nestjs/common';
import { SellerStatsService } from './seller-stats.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AdminGuard } from '../../common/guards/pro.guard';
import { ProtectedRequest } from '../../types/request.type';
import { Request as ExpressRequest } from 'express';

@Controller('seller-stats')
@UseGuards(AuthGuard)
export class SellerStatsController {
  constructor(private readonly sellerStatsService: SellerStatsService) {}

  @Get('test')
  async test() {
    return { message: 'Seller Stats API is working!', timestamp: new Date() };
  }

  @Get('quick-summary')
  async getQuickSummary(@Request() req: ProtectedRequest) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    return this.sellerStatsService.getQuickSummary(userId);
  }

  @Get('auctions/timeseries')
  async getAuctionTimeSeries(
    @Request() req: ProtectedRequest,
    @Query('months') months: number = 12
  ) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    return this.sellerStatsService.getAuctionTimeSeries(userId, months);
  }

  @Get('offers/timeseries')
  async getOfferTimeSeries(
    @Request() req: ProtectedRequest,
    @Query('months') months: number = 12
  ) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    return this.sellerStatsService.getOfferTimeSeries(userId, months);
  }

  @Get('categories/distribution')
  async getCategoryDistribution(@Request() req: ProtectedRequest) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    return this.sellerStatsService.getCategoryDistribution(userId);
  }

  @Get('price-ranges')
  async getPriceRangeDistribution(@Request() req: ProtectedRequest) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    return this.sellerStatsService.getPriceRangeDistribution(userId);
  }

  @Get('recent-activity')
  async getRecentActivity(
    @Request() req: ProtectedRequest,
    @Query('limit') limit: number = 10
  ) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    return this.sellerStatsService.getRecentActivity(userId, limit);
  }

  @Get('financial')
  async getFinancialStats(@Request() req: ProtectedRequest) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    return this.sellerStatsService.getFinancialStats(userId);
  }

  @Get('performance')
  async getPerformanceStats(@Request() req: ProtectedRequest) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    return this.sellerStatsService.getPerformanceStats(userId);
  }

  @Get('monthly-stats')
  async getMonthlyStats(
    @Request() req: ProtectedRequest,
    @Query('months') months: number = 12
  ) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    return this.sellerStatsService.getMonthlyStats(userId, months);
  }

  @Get('top-categories')
  async getTopCategories(
    @Request() req: ProtectedRequest,
    @Query('limit') limit: number = 5
  ) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    return this.sellerStatsService.getTopCategories(userId, limit);
  }

  @Get('performance-metrics')
  async getPerformanceMetrics(@Request() req: ProtectedRequest) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    return this.sellerStatsService.getPerformanceMetrics(userId);
  }

  @Get('engagement-metrics')
  async getEngagementMetrics(
    @Request() req: ProtectedRequest,
    @Query('days') days: number = 30
  ) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    return this.sellerStatsService.getEngagementMetrics(userId, days);
  }

  @Get('seller-ranking')
  async getSellerRanking(@Request() req: ProtectedRequest) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    return this.sellerStatsService.getSellerRanking(userId);
  }

  @Get('dashboard-overview')
  async getDashboardOverview(@Request() req: ProtectedRequest) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    return this.sellerStatsService.getDashboardOverview(userId);
  }

  @Post('track-view/:auctionId')
  async trackView(
    @Request() req: ProtectedRequest & ExpressRequest,
    @Param('auctionId') auctionId: string,
    @Body() body: { viewType?: string; metadata?: any }
  ) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    const viewerId = req.session.user._id.toString();
    const viewType = body.viewType || 'AUCTION_VIEW';
    const metadata = {
      ...body.metadata,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      referrer: req.get('Referer')
    };
    
    await this.sellerStatsService.trackView(userId, auctionId, viewerId, viewType, metadata);
    return { success: true, message: 'View tracked successfully' };
  }

  @Post('track-dashboard-view')
  @UseGuards(AuthGuard)
  async trackDashboardView(@Request() req: ProtectedRequest & ExpressRequest, @Body() body: { metadata?: any }) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    const viewerId = req.session.user._id.toString();
    const metadata = {
      ...body.metadata,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      referrer: req.get('Referer')
    };
    
    await this.sellerStatsService.trackDashboardView(userId, viewerId, metadata);
    return { success: true, message: 'Dashboard view tracked successfully' };
  }

  @Get('view-analytics')
  async getViewAnalytics(
    @Request() req: ProtectedRequest,
    @Query('days') days: number = 30
  ) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    return this.sellerStatsService.getViewAnalytics(userId, days);
  }
}