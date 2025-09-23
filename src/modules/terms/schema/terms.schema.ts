import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TermsDocument = Terms & Document;

@Schema({ timestamps: true })
export class Terms {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  content: string;

  @Prop({ required: true })
  version: string;

  @Prop({ required: true })
  createdBy: string; // Admin user ID

  @Prop()
  updatedBy?: string; // Admin user ID

  // These will be automatically added by timestamps: true
  createdAt?: Date;
  updatedAt?: Date;
}

export const TermsSchema = SchemaFactory.createForClass(Terms);