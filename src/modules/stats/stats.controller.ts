import { Controller, Get } from '@nestjs/common';
import { StatsService, UserStats, AuctionStats, CategoryStats } from './stats.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('stats')
@Public()
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('users')
  async getUserStats(): Promise<UserStats> {
    return this.statsService.getUserStats();
  }

  @Get('auctions')
  async getAuctionStats(): Promise<AuctionStats> {
    return this.statsService.getAuctionStats();
  }

  @Get('categories')
  async getCategoryStats(): Promise<CategoryStats[]> {
    return this.statsService.getCategoryStats();
  }

  @Get('summary')
  async getStatsSummary() {
    const [users, auctions] = await Promise.all([
      this.statsService.getUserStats(),
      this.statsService.getAuctionStats(),
    ]);
    return {
      totalUsers: users.total,
      totalAuctions: auctions.total,
      totalActiveUsers: users.byType.professional + users.byType.client,
      lastUpdated: new Date(),
    };
  }

  @Get('dashboard')
  async getDashboardStats() {
    const [users, auctions] = await Promise.all([
      this.statsService.getUserStats(),
      this.statsService.getAuctionStats(),
    ]);
    return {
      widgets: [
        {
          title: 'Total Users',
          value: users.total,
          icon: 'users',
        },
        {
          title: 'Total Auctions',
          value: auctions.total,
          icon: 'auction',
        },
        {
          title: 'Active Users',
          value: users.byType.professional + users.byType.client,
          icon: 'active-users',
        },
      ],
      userBreakdown: users.byType,
    };
  }

  @Get('users/timeseries')
  async getUserTimeSeries() {
    return this.statsService.getUserTimeSeries();
  }

  @Get('auctions/timeseries')
  async getAuctionTimeSeries() {
    return this.statsService.getAuctionTimeSeries();
  }

  @Get('auctions/status-timeseries')
  async getAuctionStatusTimeSeries() {
    return this.statsService.getAuctionStatusTimeSeries();
  }

  @Get('auctions/category-timeseries')
  async getAuctionCategoryTimeSeries() {
    return this.statsService.getAuctionCategoryTimeSeries();
  }
} 