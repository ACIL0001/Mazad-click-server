import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { User } from 'src/modules/user/schema/user.schema';
import { v4 as uuid } from 'uuid';

@Schema({ timestamps: true })
export class Session {
  _id: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true })
  user: User;

  @Prop({ type: String, required: true })
  access_key: string;

  @Prop({ type: String, required: true })
  refresh_key: string;

  // TODO: ADD DEVICE HERE

  createdAt: string;
  updatedAt: string;
}

export type SessionDocument = HydratedDocument<Session>;
export const SessionSchema = SchemaFactory.createForClass(Session);

SessionSchema.pre('validate', function (next) {
  this.access_key = uuid();
  this.refresh_key = uuid();
  next();
});

SessionSchema.index({ access_key: 1 });
SessionSchema.index({ refresh_key: 1 });
SessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
