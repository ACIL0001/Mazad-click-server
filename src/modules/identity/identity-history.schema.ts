import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Identity, CONVERSION_TYPE } from './identity.schema';
import { User } from '../user/schema/user.schema';

export enum ACTION_TYPE {
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Schema({ timestamps: true })
export class IdentityHistory {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Identity.name, required: true })
  identity: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true })
  user: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(ACTION_TYPE), required: true })
  actionType: ACTION_TYPE;

  @Prop({ type: String, enum: Object.values(CONVERSION_TYPE), required: true })
  conversionType: CONVERSION_TYPE;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: false })
  admin?: Types.ObjectId;

  @Prop({ type: String, required: false })
  notes?: string;
  
  // Mongoose automatically adds createdAt and updatedAt
  createdAt?: string;
  updatedAt?: string;
}

export type IdentityHistoryDocument = HydratedDocument<IdentityHistory>;
export const IdentityHistorySchema = SchemaFactory.createForClass(IdentityHistory);
