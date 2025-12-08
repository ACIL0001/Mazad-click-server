import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as S } from 'mongoose';
import { Attachment } from '../../attachment/schema/attachment.schema';

@Schema({ timestamps: true })
export class Ad {
  _id: string;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: S.Types.ObjectId, ref: Attachment.name, required: true })
  image: string;

  @Prop({ required: true, trim: true })
  url: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Boolean, default: false })
  isDisplayed: boolean;

  @Prop({ type: Number, default: 0 })
  order: number;
}

export type AdDocument = HydratedDocument<Ad>;
export const AdSchema = SchemaFactory.createForClass(Ad);

