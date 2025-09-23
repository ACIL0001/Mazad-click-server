import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { Category } from '../../category/schema/category.schema';
import { Attachment } from '../../attachment/schema/attachment.schema';
import { Buyer } from 'src/modules/user/schema/client.schema';
import { User } from 'src/modules/user/schema/user.schema';

export enum BID_TYPE {
  PRODUCT = 'PRODUCT',
  SERVICE = 'SERVICE',
}

export enum BID_STATUS {
  OPEN = 'OPEN',
  ON_AUCTION = 'ACCEPTED',
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIVED',
}

export enum AUCTION_TYPE {
  CLASSIC = 'CLASSIC',
  EXPRESS = 'EXPRESS',
  AUTO_SUB_BID = 'AUTO_SUB_BID',
}

@Schema({ timestamps: true })
export class Bid {
  _id: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  owner: User;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true })
  description: string;

  @Prop({ type: [String], default: [] })
  attributes: string[];

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Category.name,
    required: true,
  })
  productCategory: Category;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'SubCategory',
    required: false,
  })
  productSubCategory: any;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: Attachment.name }],
  })
  thumbs: Attachment[];

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: Attachment.name }],
  })
  videos: Attachment[];

  @Prop({ type: Date, required: true })
  startingAt: Date;

  @Prop({ type: Date, required: true })
  endingAt: Date;

  @Prop({ type: String, enum: Object.values(BID_TYPE), required: true })
  bidType: BID_TYPE;

  @Prop({
    type: String,
    enum: Object.values(AUCTION_TYPE),
    default: AUCTION_TYPE.CLASSIC,
    required: true,
  })
  auctionType: AUCTION_TYPE;

  @Prop({ type: Number, required: true })
  startingPrice: number;

  @Prop({ type: String })
  quantity: String;

  @Prop({ type: String })
  wilaya: String;

  // @Prop({ type: Boolean, default: false })
  // isSell: boolean;

  @Prop({ type: Number, required: true })
  currentPrice: number;

  @Prop({ type: Boolean, required: true })
  isPro: boolean;

  @Prop({ type: Boolean, required: true , default: false })
  hidden: boolean;

  @Prop({ type: String, required: true })
  place: String;

  @Prop({ type: Number })
  reservePrice?: number;

  @Prop({ type: Number })
  instantBuyPrice?: number;

  @Prop({ type: Number })
  maxAutoBid?: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name })
  winner?: User;

  @Prop({
    type: String,
    enum: Object.values(BID_STATUS),
    default: BID_STATUS.OPEN,
  })
  status: BID_STATUS;

  @Prop({ type: Boolean, default: false })
  last5PercentNotificationSent: boolean;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Comment' }],
    default: [],
  })
  /**
   * Array of ObjectIds referencing comments related to this bid.
   * Each comment is stored in the comments collection with the comment text and userId.
   */
  comments: MongooseSchema.Types.ObjectId[];
}

export type BidDocument = HydratedDocument<Bid>;
export const BidSchema = SchemaFactory.createForClass(Bid);

BidSchema.pre('find', function() {
  this.populate('productCategory');
  this.populate('productSubCategory');
});

BidSchema.pre('findOne', function() {
  this.populate('productCategory');
  this.populate('productSubCategory');
});
