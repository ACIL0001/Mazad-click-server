import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types, Document } from 'mongoose';

@Schema({ timestamps: true })
export class AnnouncementReview {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  reviewer: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  announcement: Types.ObjectId;

  /** Dynamic ref — Mongoose uses this to know which collection to populate */
  @Prop({ type: String, enum: ['Bid', 'DirectSale', 'Tender'], required: true })
  announcementModel: 'Bid' | 'DirectSale' | 'Tender';

  /** Denormalized seller ID for fast user-score queries (avoids cross-collection join on read) */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  seller: Types.ObjectId;

  @Prop({ type: Number, min: 1, max: 5, required: true })
  stars: number;

  @Prop({ type: String, maxlength: 500 })
  comment?: string;
}

export type AnnouncementReviewDocument = AnnouncementReview & Document;
export const AnnouncementReviewSchema = SchemaFactory.createForClass(AnnouncementReview);

// One review per (reviewer × announcement)
AnnouncementReviewSchema.index({ reviewer: 1, announcement: 1 }, { unique: true });
// Fast announcement-level lookup
AnnouncementReviewSchema.index({ announcement: 1 });
// Fast seller-score recalculation
AnnouncementReviewSchema.index({ seller: 1 });
