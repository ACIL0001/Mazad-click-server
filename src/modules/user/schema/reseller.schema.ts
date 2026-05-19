import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as S } from 'mongoose';
import { User, UserSchema } from './user.schema';
import { Attachment } from 'src/modules/attachment/schema/attachment.schema';
import { Subscription } from 'src/modules/subscription/schema/subscription.schema';

@Schema({ timestamps: true })
export class Reseller extends User {
  @Prop({
    type: Object,
    required: true,
    default: undefined,
  })
  identity: {
    identityCard: Attachment;
  };

  @Prop({ type: S.Types.ObjectId, ref: Subscription.name, required: true })
  subscription: Subscription;

  @Prop({ type: 'boolean', default: false })
  isActive: boolean;

  @Prop({ type: 'boolean', default: false })
  isBanned: boolean;

  @Prop({ type: [S.Types.ObjectId], default: [] })
  review: string[];
}

export type ResellerDocument = HydratedDocument<Reseller>;
export const ResellerSchema = UserSchema.discriminator(
  Reseller.name,
  SchemaFactory.createForClass(Reseller),
);

// Custom validation for identity fields (only for RESELLER)
ResellerSchema.pre('validate', function(next) {
  const reseller = this as any;
  if (!reseller.identity || !reseller.identity.identityCard) {
    return next(new Error('Reseller must provide an identityCard.'));
  }
  next();
});
