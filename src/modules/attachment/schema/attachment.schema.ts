import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../user/schema/user.schema';

export enum AttachmentAs {
  AVATAR = 'AVATAR',
  COVER = 'COVER',
  MESSAGE = 'MESSAGE',
  IDENTITY = 'IDENTITY',
  BID = 'BID',
  CATEGORY = 'CATEGORY',
  SUBCATEGORY = 'SUBCATEGORY',
}

@Schema({ versionKey: false, timestamps: true })
export class Attachment extends Document {

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, index: true })
  user?: User | Types.ObjectId;


  @Prop({ required: false, trim: true, maxlength: 200 })
  fieldname?: string;

  @Prop({ required: false, trim: true, maxlength: 200 })
  originalname?: string;

  @Prop({ required: true })
  encoding: string;

  @Prop({ required: true })
  mimetype: string;

  @Prop({ required: false })
  destination?: string;

  @Prop({ required: false })
  filename?: string;

  @Prop({ required: true })
  path: string;

  @Prop({ required: false })
  size?: number;

  @Prop({ default: () => new Date() })
  createdAt: Date;

  @Prop({ required: true, enum: AttachmentAs })
  as: AttachmentAs;

  @Prop({ required: false, trim: true, maxlength: 500 })
  url?: string;


}

export type AttachmentDocument = Attachment & Document;
export const AttachmentSchema = SchemaFactory.createForClass(Attachment);
