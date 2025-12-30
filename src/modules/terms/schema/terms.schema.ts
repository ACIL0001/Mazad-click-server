import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Attachment } from '../../attachment/schema/attachment.schema';

export type TermsDocument = Terms & Document;

@Schema({ timestamps: true })
export class Terms {
  @Prop({ required: true })
  title: string;

  @Prop({ required: false })
  content?: string;

  @Prop({ type: Types.ObjectId, ref: 'Attachment', required: false })
  attachment?: Attachment | Types.ObjectId;

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