import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as S } from 'mongoose';
import { Bid } from './bid.schema';
import { Buyer } from 'src/modules/user/schema/client.schema';
import { User } from 'src/modules/user/schema/user.schema';

export enum OfferStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
}

@Schema({ timestamps: true })
export class Offer {
  _id: string;

  @Prop({ type: S.Types.ObjectId, ref: User.name, required: true })
  user: User;

  @Prop({ type: S.Types.ObjectId, ref: User.name, required: true })
  owner: User;

  @Prop({ type: S.Types.ObjectId, ref: Bid.name, required: false })
  bid: Bid;

  @Prop({ type: S.Types.ObjectId, required: false })
  tenderId: string;

  @Prop({ type: Number, required: true })
  price: number;

  @Prop({ type: String, enum: Object.values(OfferStatus), default: OfferStatus.PENDING })
  status: OfferStatus;

  createdAt: Date;
  updateAt: Date;
}
export type OfferDocument = HydratedDocument<Offer>;
export const OfferSchema = SchemaFactory.createForClass(Offer);
OfferSchema.index({ bid: 1 });





// OfferSchema.pre('findById', function() {
//   this.populate('user', 'firstname lastname tel');
//   this.populate('bid', 'title');
// });

// Performance Indexes
OfferSchema.index({ tenderId: 1, status: 1 });
OfferSchema.index({ owner: 1 });
OfferSchema.index({ user: 1 });
