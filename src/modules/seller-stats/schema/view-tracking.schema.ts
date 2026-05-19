import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { Bid } from '../../bid/schema/bid.schema';
import { User } from '../../user/schema/user.schema';

export enum ViewType {
  AUCTION_VIEW = 'AUCTION_VIEW',
  AUCTION_CLICK = 'AUCTION_CLICK',
  PROFILE_VIEW = 'PROFILE_VIEW',
  DASHBOARD_VIEW = 'DASHBOARD_VIEW',
}

@Schema({ timestamps: true })
export class ViewTracking {
  _id: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: false, // Optional for anonymous views
  })
  viewer?: User;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: true, // The owner of the content being viewed
  })
  owner: User;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Bid.name,
    required: false, // Optional for non-auction views
  })
  auction?: Bid;

  @Prop({
    type: String,
    enum: Object.values(ViewType),
    required: true,
  })
  viewType: ViewType;

  @Prop({ type: String, required: false })
  ipAddress?: string;

  @Prop({ type: String, required: false })
  userAgent?: string;

  @Prop({ type: String, required: false })
  referrer?: string;

  @Prop({ type: Number, default: 1 })
  viewCount: number;

  @Prop({ type: Date, default: Date.now })
  lastViewedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export type ViewTrackingDocument = HydratedDocument<ViewTracking>;
export const ViewTrackingSchema = SchemaFactory.createForClass(ViewTracking);

// Indexes for better performance
ViewTrackingSchema.index({ owner: 1, viewType: 1, createdAt: -1 });
ViewTrackingSchema.index({ auction: 1, createdAt: -1 });
ViewTrackingSchema.index({ viewer: 1, createdAt: -1 });
ViewTrackingSchema.index({ createdAt: -1 });
