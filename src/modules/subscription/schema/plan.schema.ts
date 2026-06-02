import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class Plan {
  _id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ type: String, required: true })
  description: string;

  @Prop({ type: Number, required: true })
  price: number;

  @Prop({ type: Number, required: true })
  duration: number; // in months

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: String, enum: ['PROFESSIONAL', 'CLIENT'], required: true })
  role: string;

  @Prop({ type: [String], default: [] })
  benefits: string[];

  @Prop({ type: Number, default: -1 })
  announcesPerMonth: number;

  @Prop({ type: Number, default: 0 })
  photosLimit: number;

  @Prop({ type: Number, default: 0 })
  videosLimit: number;

  @Prop({ type: Number, default: 0 })
  enchereSoumissionLimit: number;

  @Prop({ type: Boolean, default: false })
  hasChatAndMessaging: boolean;

  @Prop({ type: Boolean, default: false })
  hasRatingAndHistory: boolean;

  @Prop({ type: Boolean, default: false })
  isDurationUnlimited: boolean;

  @Prop({ type: Boolean, default: false })
  hasAutoTranslation: boolean;

  @Prop({ type: String, enum: ['STANDARD', 'BASIC', 'ADVANCED'], default: 'STANDARD' })
  statisticsLevel: string;

  @Prop({ type: Boolean, default: false })
  hasMiseEnAvant: boolean;

  @Prop({ type: Boolean, default: false })
  hasEmailNotification: boolean;

  @Prop({ type: String, default: '#0EA5E9' })
  color: string;
}

export type PlanDocument = HydratedDocument<Plan>;
export const PlanSchema = SchemaFactory.createForClass(Plan);
