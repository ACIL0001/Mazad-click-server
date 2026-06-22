import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AnalyticsSummaryDocument = HydratedDocument<AnalyticsSummary>;

@Schema({ timestamps: true, collection: 'analytics_summaries' })
export class AnalyticsSummary {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  date: string; // "2026-06-11"

  @Prop({ required: true, enum: ['hourly', 'daily'], index: true })
  granularity: string;

  @Prop({ type: Number, min: 0, max: 23 })
  hour: number; // Only for hourly granularity

  // ── Traffic Metrics ──
  @Prop({ default: 0 })
  totalSessions: number;

  @Prop({ default: 0 })
  uniqueVisitors: number;

  @Prop({ default: 0 })
  pageViews: number;

  @Prop({ default: 0 })
  bounceCount: number;

  @Prop({ default: 0 })
  avgSessionDurationSec: number;

  @Prop({ default: 0 })
  avgPagesPerSession: number;

  // ── Device Breakdown ──
  @Prop({
    type: {
      desktop: { type: Number, default: 0 },
      mobile: { type: Number, default: 0 },
      tablet: { type: Number, default: 0 },
    },
    _id: false,
    default: { desktop: 0, mobile: 0, tablet: 0 },
  })
  deviceBreakdown: {
    desktop: number;
    mobile: number;
    tablet: number;
  };

  // ── Traffic Source Breakdown ──
  @Prop({
    type: {
      direct: { type: Number, default: 0 },
      organic: { type: Number, default: 0 },
      social: { type: Number, default: 0 },
      referral: { type: Number, default: 0 },
      paid: { type: Number, default: 0 },
      email: { type: Number, default: 0 },
    },
    _id: false,
    default: { direct: 0, organic: 0, social: 0, referral: 0, paid: 0, email: 0 },
  })
  sourceBreakdown: {
    direct: number;
    organic: number;
    social: number;
    referral: number;
    paid: number;
    email: number;
  };

  // ── Geographic Breakdown ──
  @Prop({
    type: [
      {
        wilaya: { type: String },
        sessions: { type: Number, default: 0 },
      },
    ],
    _id: false,
    default: [],
  })
  topWilayas: { wilaya: string; sessions: number }[];

  // ── Business Metrics ──
  @Prop({ default: 0 })
  bidsPlaced: number;

  @Prop({ default: 0 })
  auctionsCreated: number;

  @Prop({ default: 0 })
  tendersViewed: number;

  @Prop({ default: 0 })
  cahiersDownloaded: number;

  @Prop({ default: 0 })
  directSalesInitiated: number;

  @Prop({ default: 0 })
  directSalesCompleted: number;

  @Prop({ default: 0 })
  registrations: number;

  @Prop({ default: 0 })
  logins: number;

  @Prop({ default: 0 })
  searchesPerformed: number;

  // ── Revenue Metrics ──
  @Prop({ default: 0 })
  totalGTV: number;

  @Prop({ default: 0 })
  subscriptionRevenue: number;

  @Prop({ default: 0 })
  averageOrderValue: number;

  // ── Conversion Funnel Snapshots ──
  @Prop({
    type: {
      listViews: { type: Number, default: 0 },
      detailViews: { type: Number, default: 0 },
      bidClicks: { type: Number, default: 0 },
      bidsPlaced: { type: Number, default: 0 },
    },
    _id: false,
    default: { listViews: 0, detailViews: 0, bidClicks: 0, bidsPlaced: 0 },
  })
  auctionFunnel: {
    listViews: number;
    detailViews: number;
    bidClicks: number;
    bidsPlaced: number;
  };

  @Prop({
    type: {
      listViews: { type: Number, default: 0 },
      detailViews: { type: Number, default: 0 },
      cahierDownloads: { type: Number, default: 0 },
      bidsSubmitted: { type: Number, default: 0 },
    },
    _id: false,
    default: { listViews: 0, detailViews: 0, cahierDownloads: 0, bidsSubmitted: 0 },
  })
  tenderFunnel: {
    listViews: number;
    detailViews: number;
    cahierDownloads: number;
    bidsSubmitted: number;
  };
}

export const AnalyticsSummarySchema = SchemaFactory.createForClass(AnalyticsSummary);

// Unique compound index prevents duplicate entries
AnalyticsSummarySchema.index({ date: 1, granularity: 1, hour: 1 }, { unique: true });
