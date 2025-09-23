import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as S } from 'mongoose';
import { User } from 'src/modules/user/schema/user.schema';

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired'
}

export enum PaymentMethod {
  CIB = 'cib',
  EDAHABIA = 'edahabia',
  SATIM = 'satim',
  VISA = 'visa',
  MASTERCARD = 'mastercard'
}

@Schema({ timestamps: true })
export class Payment {
  _id: string;

  @Prop({ type: S.Types.ObjectId, ref: User.name, required: true })
  user: User;

  @Prop({ required: true })
  subscriptionPlan: string; // '6mois' or '1an'

  @Prop({ required: true })
  amount: number; // Amount in DZD

  @Prop({ required: true })
  currency: string; // 'DZD'

  @Prop({ type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Prop({ type: String, enum: Object.values(PaymentMethod), required: false })
  paymentMethod: PaymentMethod;

  // SlickPay specific fields
  @Prop({ required: false })
  slickpayTransferId: string; // SlickPay transfer ID (can be string or number from API)

  @Prop({ required: false })
  slickpayPaymentUrl: string; // SlickPay payment URL

  @Prop({ required: false })
  slickpayTransactionReference: string; // SlickPay transaction reference

  @Prop({ required: false })
  slickpayCommission: number; // SlickPay commission

  // Payment metadata
  @Prop({ type: Object, required: false })
  metadata: {
    userInfo?: {
      firstName: string;
      lastName: string;
      phone: string;
      email: string;
    };
    paymentDetails?: any;
    slickpayResponse?: any;
    satimResponse?: any;
    mdOrder?: string;
    gateway?: string;
    alternativeUrls?: string[];
    satimUrl?: string;
    originalGateway?: string;
    finalGateway?: string;
    fallbackReason?: string;
  };

  @Prop({ required: false })
  completedAt: Date;

  @Prop({ required: false })
  failureReason: string;

  @Prop({ required: false })
  expiresAt: Date; // Payment expiry time

  createdAt: Date;
  updatedAt: Date;
}

export type PaymentDocument = HydratedDocument<Payment>;
export const PaymentSchema = SchemaFactory.createForClass(Payment); 