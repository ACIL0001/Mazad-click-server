import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsAggregationService } from './analytics-aggregation.service';
import {
  AnalyticsSession,
  AnalyticsSessionSchema,
} from './schemas/analytics-session.schema';
import {
  AnalyticsEvent,
  AnalyticsEventSchema,
} from './schemas/analytics-event.schema';
import {
  AnalyticsSummary,
  AnalyticsSummarySchema,
} from './schemas/analytics-summary.schema';
import {
  AnalyticsHeatmap,
  AnalyticsHeatmapSchema,
} from './schemas/analytics-heatmap.schema';
import { SocketModule } from '../../socket/socket.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AnalyticsSession.name, schema: AnalyticsSessionSchema },
      { name: AnalyticsEvent.name, schema: AnalyticsEventSchema },
      { name: AnalyticsSummary.name, schema: AnalyticsSummarySchema },
      { name: AnalyticsHeatmap.name, schema: AnalyticsHeatmapSchema },
    ]),
    SocketModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsAggregationService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
