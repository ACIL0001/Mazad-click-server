import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as S } from 'mongoose';
import { User } from 'src/modules/user/schema/user.schema';
import { Plan } from './plan.schema';

@Schema({ timestamps: true })
export class Subscription {
  _id: string;

  @Prop({ required: true })
  id: string;

  @Prop({ type: S.Types.ObjectId, ref: User.name, required: true })
  user: User;

  @Prop({ type: S.Types.ObjectId, ref: Plan.name, required: true })
  plan: Plan;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export type SubscriptionDocument = HydratedDocument<Subscription>;
export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
