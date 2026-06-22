import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type AnalyticsSessionDocument = HydratedDocument<AnalyticsSession>;

@Schema({ timestamps: true, collection: 'analytics_sessions' })
export class AnalyticsSession {
  _id: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  sessionId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null, index: true })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['guest', 'client', 'professional', 'reseller', 'admin'],
    default: 'guest',
  })
  userType: string;

  @Prop({ required: true })
  ipMasked: string;

  @Prop({ default: 'Algeria' })
  country: string;

  @Prop({ default: '', index: true })
  wilaya: string;

  @Prop({ default: '' })
  city: string;

  @Prop({ type: String, enum: ['desktop', 'mobile', 'tablet'], required: true, index: true })
  deviceType: string;

  @Prop({ default: '' })
  browser: string;

  @Prop({ default: '' })
  os: string;

  @Prop({ default: '' })
  screenResolution: string;

  @Prop({ default: '' })
  referrer: string;

  @Prop({ default: '' })
  landingPage: string;

  @Prop({
    type: {
      source: { type: String, default: '' },
      medium: { type: String, default: '' },
      campaign: { type: String, default: '' },
      term: { type: String, default: '' },
      content: { type: String, default: '' },
    },
    _id: false,
    default: {},
  })
  utm: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };

  @Prop({ default: 0 })
  durationSeconds: number;

  @Prop({ default: 1 })
  pageCount: number;

  @Prop({ default: false })
  isBounce: boolean;

  @Prop({ default: '' })
  exitPage: string;

  @Prop({ type: Date })
  endedAt: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AnalyticsSessionSchema = SchemaFactory.createForClass(AnalyticsSession);

// Compound indexes for efficient queries
AnalyticsSessionSchema.index({ createdAt: 1 });
AnalyticsSessionSchema.index({ wilaya: 1, createdAt: 1 });
AnalyticsSessionSchema.index({ deviceType: 1, createdAt: 1 });
AnalyticsSessionSchema.index({ userType: 1, createdAt: 1 });
AnalyticsSessionSchema.index({ 'utm.source': 1, createdAt: 1 });
