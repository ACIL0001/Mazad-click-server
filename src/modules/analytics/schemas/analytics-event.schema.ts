import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type AnalyticsEventDocument = HydratedDocument<AnalyticsEvent>;

/**
 * Comprehensive event taxonomy for MazadClick:
 *
 * PAGE:         page_view, page_exit
 * AUCTION:      auction_list_view, auction_detail_view, bid_placed, bid_won,
 *               auction_created, auction_shared, auction_favorited
 * TENDER:       tender_list_view, tender_detail_view, cahier_downloaded,
 *               tender_bid_submitted
 * DIRECT_SALE:  ds_list_view, ds_detail_view, ds_purchase_initiated,
 *               ds_purchase_completed
 * AUTH:         login_success, login_failed, register_started, register_completed,
 *               otp_verified, logout
 * SEARCH:       search_performed, search_result_clicked, filter_applied
 * ENGAGEMENT:   rage_click, dead_click, scroll_depth, time_on_page
 * CHAT:         chat_opened, message_sent
 * SUBSCRIPTION: plan_viewed, plan_selected, payment_initiated,
 *               payment_completed, payment_failed
 */

@Schema({ timestamps: true, collection: 'analytics_events' })
export class AnalyticsEvent {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  sessionId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, index: true })
  eventName: string;

  @Prop({ required: true })
  urlPath: string;

  @Prop({ default: '' })
  pageTitle: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  properties: Record<string, any>;

  @Prop({ default: '' })
  elementSelector: string;

  @Prop({
    type: {
      x: { type: Number },
      y: { type: Number },
    },
    _id: false,
  })
  position: { x: number; y: number };

  @Prop({ default: '' })
  referrer: string;
}

export const AnalyticsEventSchema = SchemaFactory.createForClass(AnalyticsEvent);

// TTL index: auto-delete raw events after 90 days (7,776,000 seconds)
AnalyticsEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

// Compound indexes for efficient aggregation queries
AnalyticsEventSchema.index({ eventName: 1, createdAt: 1 });
AnalyticsEventSchema.index({ sessionId: 1, createdAt: 1 });
AnalyticsEventSchema.index({ userId: 1, eventName: 1 });
AnalyticsEventSchema.index({ urlPath: 1, eventName: 1, createdAt: 1 });
