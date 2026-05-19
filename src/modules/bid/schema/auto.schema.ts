import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as S } from 'mongoose';
import { Bid } from './bid.schema';
import { User } from 'src/modules/user/schema/user.schema';

@Schema({ timestamps: true })
export class AutoBid {
  _id: string;

  @Prop({ type: S.Types.ObjectId, ref: User.name, required: true })
  user: User;

  @Prop({ type: S.Types.ObjectId, ref: Bid.name, required: true })
  bid: Bid;

  @Prop({ type: Number, required: true })
  price: number;

  createdAt: Date;
  updatedAt: Date;
}

export type AutoBidDocument = HydratedDocument<AutoBid>;
export const AutoBidSchema = SchemaFactory.createForClass(AutoBid);





// OfferSchema.pre('findById', function() {
//   this.populate('user', 'firstname lastname tel');
//   this.populate('bid', 'title');
// });
