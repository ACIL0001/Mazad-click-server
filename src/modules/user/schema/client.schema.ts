import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as S } from 'mongoose';
import { User, UserSchema } from './user.schema';
import { Attachment } from 'src/modules/attachment/schema/attachment.schema';

@Schema({ timestamps: true })
export class Buyer extends User {

  @Prop({
    type: Object,
    required: false,
    default: undefined,
  })
  identity: {
    identityCard: Attachment;
  };

  @Prop({ type: Boolean, default: false })
  isActive: boolean;

  @Prop({ type: Boolean, default: false })
  isBanned: boolean;

  @Prop({ type: [S.Types.ObjectId], default: [] })
  review: string[];
}

export type BuyerDocument = HydratedDocument<Buyer>;
export const BuyerSchema = UserSchema.discriminator(
  Buyer.name,
  SchemaFactory.createForClass(Buyer),
);
