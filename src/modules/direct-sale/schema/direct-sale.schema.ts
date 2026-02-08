import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { Category } from '../../category/schema/category.schema';
import { Attachment } from '../../attachment/schema/attachment.schema';
import { User } from '../../user/schema/user.schema';

export enum DIRECT_SALE_TYPE {
  PRODUCT = 'PRODUCT',
  SERVICE = 'SERVICE',
}

export enum DIRECT_SALE_STATUS {
  ACTIVE = 'ACTIVE',
  SOLD_OUT = 'SOLD_OUT',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum PURCHASE_STATUS {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

@Schema({ timestamps: true })
export class DirectSale {
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

  @Prop({ type: String, enum: Object.values(DIRECT_SALE_TYPE), required: true })
  saleType: DIRECT_SALE_TYPE;

  @Prop({ type: Number, required: true })
  price: number;

  @Prop({ type: Number, default: 0 })
  quantity: number; // 0 means unlimited

  @Prop({ type: Number, default: 0 })
  soldQuantity: number;

  @Prop({ type: String, required: true })
  wilaya: string;

  @Prop({ type: String, required: true })
  place: string;

  @Prop({ type: String })
  contactNumber?: string;

  @Prop({ type: Boolean, required: true, default: false })
  isPro: boolean;

  @Prop({ type: Boolean, required: true, default: false })
  professionalOnly: boolean;

  @Prop({ type: Boolean, required: true, default: false })
  hidden: boolean;

  @Prop({
    type: String,
    enum: Object.values(DIRECT_SALE_STATUS),
    default: DIRECT_SALE_STATUS.ACTIVE,
  })
  status: DIRECT_SALE_STATUS;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Comment' }],
    default: [],
  })
  comments: MongooseSchema.Types.ObjectId[];
}

@Schema({ timestamps: true })
export class DirectSalePurchase {
  _id: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: DirectSale.name,
    required: true,
  })
  directSale: DirectSale;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  buyer: User;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  seller: User;

  @Prop({ type: Number, required: true })
  quantity: number;

  @Prop({ type: Number, required: true })
  unitPrice: number;

  @Prop({ type: Number, required: true })
  totalPrice: number;

  @Prop({
    type: String,
    enum: Object.values(PURCHASE_STATUS),
    default: PURCHASE_STATUS.PENDING,
  })
  status: PURCHASE_STATUS;

  @Prop({ type: String })
  paymentMethod?: string;

  @Prop({ type: String })
  paymentReference?: string;

  @Prop({ type: Date })
  paidAt?: Date;

  @Prop({ type: Date })
  completedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export type DirectSaleDocument = HydratedDocument<DirectSale>;
export type DirectSalePurchaseDocument = HydratedDocument<DirectSalePurchase>;

export const DirectSaleSchema = SchemaFactory.createForClass(DirectSale);
export const DirectSalePurchaseSchema = SchemaFactory.createForClass(DirectSalePurchase);

DirectSaleSchema.pre('find', function () {
  this.populate('productCategory');
  this.populate('productSubCategory');
});

DirectSaleSchema.pre('findOne', function () {
  this.populate('productCategory');
  this.populate('productSubCategory');
});

DirectSalePurchaseSchema.pre(['find', 'findOne'], function () {
  this.populate('directSale');
  this.populate('buyer', 'firstName lastName phone email username');
  this.populate('seller', 'firstName lastName phone email username');
});

