// File: backend/src/modules/otp/schema/otp.schema.ts (Updated version)
import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Schema as S, HydratedDocument, Types } from 'mongoose';
import { User } from 'src/modules/user/schema/user.schema';

export enum OtpType {
  PHONE_CONFIRMATION = 'PHONE_CONFIRMATION',
  EMAIL_CONFIRMATION = 'EMAIL_CONFIRMATION',
  FORGOT_PASSWORD = 'FORGOT_PASSWORD',
  ORDER_PICKUP = 'ORDER_PICKUP',
  ORDER_DELIVERY = 'ORDER_DELIVERY',
}

@Schema({ 
  timestamps: true,
  collection: 'otps'
})
export class Otp {
  _id: Types.ObjectId; // Explicitly declare _id property

  @Prop({ 
    type: String, 
    length: 5, 
    required: true,
    index: true
  })
  code: string;

  @Prop({ 
    type: String, 
    enum: Object.values(OtpType), 
    required: true,
    index: true
  })
  type: OtpType;

  @Prop({ 
    type: S.Types.ObjectId, 
    ref: User.name, 
    required: true,
    index: true
  })
  user: User;

  @Prop({ type: Date })
  usedAt?: Date;

  @Prop({ 
    type: Boolean, 
    default: false,
    index: true
  })
  expired: boolean;

  @Prop({ 
    type: Boolean, 
    default: false,
    index: true
  })
  isUsed: boolean;

  // Add createdAt and updatedAt for timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

export type OtpDocument = HydratedDocument<Otp>;
export const OtpSchema = SchemaFactory.createForClass(Otp);

// Add compound indexes for better performance
OtpSchema.index({ user: 1, type: 1 });
OtpSchema.index({ user: 1, code: 1 });
OtpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 300 }); // Auto-delete after 5 minutes