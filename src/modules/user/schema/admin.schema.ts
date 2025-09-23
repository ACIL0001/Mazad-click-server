import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { User, UserSchema } from './user.schema';

export enum PERMISSIONS {
  ADMINISTRATE = 'ADMINISTRATE',
}

@Schema({ timestamps: true })
export class Admin extends User {
  @Prop({ type: [String], enum: Object.values(PERMISSIONS), required: true })
  permissions: PERMISSIONS[];

  @Prop({ type: Boolean, required: false, select: false })
  private main?: boolean; // main admin acount
}

export type AdminDocument = HydratedDocument<Admin>;
export const AdminSchema = UserSchema.discriminator(
  Admin.name,
  SchemaFactory.createForClass(Admin),
);
