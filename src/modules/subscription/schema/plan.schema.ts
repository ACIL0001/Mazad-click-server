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

  @Prop({ type: String, enum: ['PROFESSIONAL', 'RESELLER'], required: true })
  role: string;

  @Prop({ type: [String], default: [] })
  benefits: string[];
}

export type PlanDocument = HydratedDocument<Plan>;
export const PlanSchema = SchemaFactory.createForClass(Plan);
