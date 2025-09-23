import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as S } from 'mongoose';
import { Tender } from './tender.schema';
import { User } from 'src/modules/user/schema/user.schema';

export enum TenderBidStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
}

@Schema({ timestamps: true })
export class TenderBid {
  _id: string;

  @Prop({ type: S.Types.ObjectId, ref: User.name, required: true })
  bidder: User; // The person making the bid (seller)

  @Prop({ type: S.Types.ObjectId, ref: User.name, required: true })
  tenderOwner: User; // The person who created the tender (buyer)

  @Prop({ type: S.Types.ObjectId, ref: Tender.name, required: true })
  tender: Tender;

  @Prop({ type: Number, required: true })
  bidAmount: number; // The price they're willing to accept (should be lower than current)

  @Prop({ type: String })
  proposal: string; // Description of their proposal

  @Prop({ type: Number })
  deliveryTime?: number; // Estimated delivery time in days

  @Prop({ type: String, enum: Object.values(TenderBidStatus), default: TenderBidStatus.PENDING })
  status: TenderBidStatus;

  createdAt: Date;
  updatedAt: Date;
}

export type TenderBidDocument = HydratedDocument<TenderBid>;
export const TenderBidSchema = SchemaFactory.createForClass(TenderBid);

TenderBidSchema.pre(['find', 'findOne'], function() {
  this.populate({
    path: 'bidder',
    select: 'firstName lastName phone username email'
  });
  this.populate('tender', 'title');
});
