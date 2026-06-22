import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AnalyticsService } from './analytics.service';
import {
  IngestEventsDto,
  StartSessionDto,
  EndSessionDto,
  IngestHeatmapDto,
} from './dto/ingest-event.dto';
import { QueryAnalyticsDto } from './dto/query-analytics.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // ═══════════════════════════════════════════
  // ██  INGESTION ENDPOINTS (Public, Rate-Limited)
  // ═══════════════════════════════════════════

  @Post('session/start')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async startSession(
    @Body() dto: StartSessionDto,
    @Req() req: any,
  ) {
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] ||
      req.connection?.remoteAddress ||
      '0.0.0.0';
    const userAgent = req.headers['user-agent'] || '';
    const userId = dto.userId || req.user?.sub || null;
    const userType = dto.userType || req.user?.type || 'guest';
    const userWilaya = dto.userWilaya || req.user?.wilaya || req.headers['x-wilaya'] || '';

    return this.analyticsService.startSession(
      dto,
      ip,
      userAgent,
      userId,
      userType,
      userWilaya,
    );
  }

  @Post('session/end')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async endSession(@Body() dto: EndSessionDto) {
    return this.analyticsService.endSession(dto);
  }

  @Post('ingest')
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async ingestEvents(
    @Body() dto: IngestEventsDto,
    @Req() req: any,
  ) {
    const userId = dto.userId || req.user?.sub || null;
    return this.analyticsService.ingestEvents(dto, userId);
  }

  @Post('heatmap')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async ingestHeatmap(@Body() dto: IngestHeatmapDto) {
    return this.analyticsService.ingestHeatmap(dto);
  }

  // ═══════════════════════════════════════════
  // ██  ADMIN DASHBOARD ENDPOINTS (Auth Required)
  // ═══════════════════════════════════════════

  @Get('dashboard/overview')
  async getOverview(@Query() query: QueryAnalyticsDto) {
    return this.analyticsService.getOverview(query);
  }

  @Get('dashboard/traffic')
  async getTraffic(@Query() query: QueryAnalyticsDto) {
    return this.analyticsService.getTraffic(query);
  }

  @Get('dashboard/geographic')
  async getGeographic(@Query() query: QueryAnalyticsDto) {
    return this.analyticsService.getGeographic(query);
  }

  @Get('dashboard/funnels')
  async getFunnels(@Query() query: QueryAnalyticsDto) {
    return this.analyticsService.getFunnels(query);
  }

  @Get('dashboard/journeys')
  async getJourneys(@Query() query: QueryAnalyticsDto) {
    return this.analyticsService.getJourneys(query);
  }

  @Get('dashboard/heatmaps')
  async getHeatmaps(@Query() query: QueryAnalyticsDto) {
    return this.analyticsService.getHeatmaps(query);
  }

  @Get('dashboard/search')
  async getSearchAnalytics(@Query() query: QueryAnalyticsDto) {
    return this.analyticsService.getSearchAnalytics(query);
  }

  @Get('dashboard/ecommerce')
  async getEcommerce(@Query() query: QueryAnalyticsDto) {
    return this.analyticsService.getEcommerce(query);
  }

  @Get('dashboard/users/:id')
  async getUserProfile(@Param('id') id: string) {
    return this.analyticsService.getUserProfile(id);
  }

  @Get('dashboard/cohorts')
  async getCohorts(@Query() query: QueryAnalyticsDto) {
    return this.analyticsService.getCohorts(query);
  }

  @Get('dashboard/realtime')
  async getRealtime() {
    return this.analyticsService.getRealtime();
  }

  @Get('dashboard/events')
  async getEvents(
    @Query() query: QueryAnalyticsDto & { page?: number; limit?: number },
  ) {
    return this.analyticsService.getEvents(query);
  }
}
