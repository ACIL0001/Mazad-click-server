import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { Buyer } from 'src/modules/user/schema/client.schema';
import { Bid } from './bid.schema';

@Schema({ timestamps: true })
export class Participant {
  _id: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Buyer.name,
    required: true,
  })
  buyer: Buyer;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Bid.name, required: true })
  bid: Bid;

  createdAt: Date;
  updatedAt: Date;
}

export type ParticipantDocument = HydratedDocument<Participant>;
export const ParticipantSchema = SchemaFactory.createForClass(Participant);
