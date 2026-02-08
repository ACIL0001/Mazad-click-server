import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { Category } from '../../category/schema/category.schema';
import { Attachment } from '../../attachment/schema/attachment.schema';
import { User } from 'src/modules/user/schema/user.schema';

export enum TENDER_TYPE {
  PRODUCT = 'PRODUCT',
  SERVICE = 'SERVICE',
}

export enum TENDER_STATUS {
  OPEN = 'OPEN',
  AWARDED = 'AWARDED',
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIVED',
}

export enum TENDER_AUCTION_TYPE {
  CLASSIC = 'CLASSIC',
  EXPRESS = 'EXPRESS',
}

export enum TENDER_EVALUATION_TYPE {
  MOINS_DISANT = 'MOINS_DISANT', // Lowest price wins
  MIEUX_DISANT = 'MIEUX_DISANT', // Best value/proposal wins
}

@Schema({ timestamps: true })
export class Tender {
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
  requirements: string[];

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Category.name,
    required: true,
  })
  category: Category;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'SubCategory',
    required: false,
  })
  subCategory: any;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: Attachment.name }],
  })
  attachments: Attachment[];

  @Prop({ type: Date, required: true })
  startingAt: Date;

  @Prop({ type: Date, required: true })
  endingAt: Date;

  @Prop({ type: String, enum: Object.values(TENDER_TYPE), required: true })
  tenderType: TENDER_TYPE;

  @Prop({
    type: String,
    enum: Object.values(TENDER_AUCTION_TYPE),
    default: TENDER_AUCTION_TYPE.CLASSIC,
    required: true,
  })
  auctionType: TENDER_AUCTION_TYPE;

  @Prop({
    type: String,
    enum: Object.values(TENDER_EVALUATION_TYPE),
    default: TENDER_EVALUATION_TYPE.MOINS_DISANT,
    required: true,
  })
  evaluationType: TENDER_EVALUATION_TYPE;

  @Prop({ type: String })
  quantity: String;

  @Prop({ type: String })
  wilaya: String;

  @Prop({ type: String, required: true })
  location: String;

  @Prop({ type: String })
  contactNumber?: string;

  @Prop({ type: Number, required: false })
  maxBudget?: number; // Maximum budget for the tender

  @Prop({ type: Boolean, required: true })
  isPro: boolean;

  @Prop({ type: Boolean, required: true, default: false })
  professionalOnly: boolean;

  @Prop({ type: Boolean, required: true, default: false })
  hidden: boolean;


  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name })
  awardedTo?: User; // Winner of the tender

  @Prop({
    type: String,
    enum: Object.values(TENDER_STATUS),
    default: TENDER_STATUS.OPEN,
  })
  status: TENDER_STATUS;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Comment' }],
    default: [],
  })
  comments: MongooseSchema.Types.ObjectId[];

  @Prop({ type: Number, default: 0 })
  participantsCount: number;
}

export type TenderDocument = HydratedDocument<Tender>;
export const TenderSchema = SchemaFactory.createForClass(Tender);

TenderSchema.pre('find', function () {
  this.populate('category');
  this.populate('subCategory');
});

TenderSchema.pre('findOne', function () {
  this.populate('category');
  this.populate('subCategory');
});
