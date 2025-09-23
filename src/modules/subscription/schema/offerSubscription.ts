import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from 'src/modules/user/schema/user.schema';
import { Bid } from 'src/modules/bid/schema/bid.schema';

@Schema({ timestamps: true })
export class OfferSubscription {
  _id: string;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  user: User;

  @Prop({ type: Types.ObjectId, ref: Bid.name, required: true })
  bid: Bid;

  @Prop({ type: Number, required: true })
  by: number;

  @Prop({ type: Number, required: true })
  maxPrice: number;
}

export type OfferSubscriptionDocument = HydratedDocument<OfferSubscription>;
export const OfferSubscriptionSchema =
  SchemaFactory.createForClass(OfferSubscription);
