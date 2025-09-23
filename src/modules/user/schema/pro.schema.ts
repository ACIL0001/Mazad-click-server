import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as S } from 'mongoose';
import { User, UserSchema } from './user.schema';
import { Attachment } from 'src/modules/attachment/schema/attachment.schema';
import { Subscription } from 'src/modules/subscription/schema/subscription.schema';

@Schema({ timestamps: true })
export class Professional extends User {

  @Prop({ type: S.Types.ObjectId, ref: Subscription.name, required: false, default: undefined })
  subscription?: Subscription;

  @Prop({ type: 'boolean', default: false })
  isActive: boolean;

  @Prop({ type: 'boolean', default: false })
  isBanned: boolean;

  @Prop({ type: [S.Types.ObjectId], default: [] })
  review: string[];

  @Prop({ type: S.Types.ObjectId, ref: 'Identity', required: false, default: undefined })
  identity?: any;
}

export type ProfessionalDocument = HydratedDocument<Professional>;
export const ProfessionalSchema = UserSchema.discriminator(
  Professional.name,
  SchemaFactory.createForClass(Professional),
);
