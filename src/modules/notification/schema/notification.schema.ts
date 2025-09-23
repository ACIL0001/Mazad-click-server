import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

export enum NotificationType {
  BID_CREATED = 'BID_CREATED',
  NEW_OFFER = 'NEW_OFFER',
  BID_ENDED = 'BID_ENDED',
  BID_WON = 'BID_WON',
  ITEM_SOLD = 'ITEM_SOLD',
  CHAT_CREATED = 'CHAT_CREATED',
  MESSAGE_RECEIVED = 'MESSAGE_RECEIVED',
  AUCTION_WON = 'AUCTION_WON',
  AUCTION_LOST = 'AUCTION_LOST',
  AUCTION_ENDING_SOON = 'AUCTION_ENDING_SOON',
  BID_OUTBID = 'BID_OUTBID',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  MESSAGE_ADMIN = 'MESSAGE_ADMIN',
}

@Schema({ timestamps: true })
export class Notification {
  _id: Types.ObjectId;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ type: String, enum: NotificationType, required: true })
  type: NotificationType;

  @Prop({ type: MongooseSchema.Types.Mixed })
  data: any;

  @Prop({ default: false })
  read: boolean;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);