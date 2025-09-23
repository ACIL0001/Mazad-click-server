import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as S, Types } from 'mongoose';
// import { Attachment } from 'src/modules/attachement/schema/attachement.schema';
import { Attachment } from 'src/modules/attachment/schema/attachment.schema';
import * as bcrypt from 'bcrypt';
import { RoleCode } from 'src/modules/apikey/entity/appType.entity';

export enum GENDER {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}
@Schema({ timestamps: true })
export class User {
  _id: Types.ObjectId;

  @Prop({ type: S.Types.ObjectId, ref: Attachment.name, required: false })
  avatar?: Attachment;


  @Prop({ type: String, enum: Object.values(GENDER), required: false })
  gender: GENDER;

  @Prop({ type: String, required: true })
  firstName: string;

  @Prop({ type: String, required: true })
  lastName: string;

  @Prop({ type: String, required: false })
  email: string;

  @Prop({ type: String, required: true, select: false })
  password: string;

  @Prop({ type: String, required: true, unique: true })
  phone: string;

  @Prop({ type: Boolean, default: false })
  isPhoneVerified: boolean;

  @Prop({ type: Boolean, default: false })
  isVerified: boolean;

  @Prop({ type: Boolean, default: false })
  isHasIdentity: boolean;

  @Prop({ type: String, enum: Object.values(RoleCode), required: true })
  type: RoleCode;

  @Prop({ type: Number, min: 1, max: 10 })
  rate: number;

  @Prop({ type: String, required: false })
  subscriptionPlan?: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Boolean, default: false })
  isBanned: boolean;

  @Prop({ type: S.Types.ObjectId, ref: 'Identity', required: false, default: undefined })
  identity?: any;

  @Prop({ type: Boolean, default: false })
isRecommended: boolean;


  createdAt: string;
  updatedAt: string;

  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  getFullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.set('discriminatorKey', '__t');

// Set default rate based on role
UserSchema.path('rate').default(function () {
  switch (this.type) {
    case 'CLIENT':
      return 3;
    case 'RESELLER':
      return 5;
    case 'PROFESSIONAL':
      return 6;
    case 'SOUS_ADMIN':
      return 9;
    case 'ADMIN':
      return 10;
    default:
      return 3;
  }
});

UserSchema.pre('save', function (next) {
  const user = this as UserDocument;
  if (!user.isModified('password')) {
    return next();
  }

  bcrypt.hash(user.password, 10).then((result) => {
    user.password = result;
    next();
  });
});

UserSchema.methods.validatePassword = async function (
  password: string,
): Promise<boolean> {
  const user = this as UserDocument;
  const u = await user.$model().findById(user._id).select('+password');

  return bcrypt.compare(password, u.password);
};

UserSchema.methods.getFullName = function () {
  const user = this as UserDocument;
  return `${user.firstName} ${user.lastName}`;
};

// Add virtual field for photoURL for frontend compatibility
UserSchema.virtual('photoURL').get(function () {
  const user = this as UserDocument;
  if (user.avatar?.url) {
    const appHost = process.env.APP_HOST || 'http://localhost';
    const appPort = process.env.APP_PORT || 3000;
    
    const hostPart = appPort ? appHost.replace(/\/$/, '') : appHost;
    const baseUrl = appPort ? `${hostPart}:${appPort}` : hostPart;
    
    return `${baseUrl}${user.avatar.url}`;
  }
  // Return null if there is no avatar.
  return null;
});

// Add virtual field for fullName for frontend compatibility
UserSchema.virtual('fullName').get(function () {
  const user = this as UserDocument;
  return `${user.firstName} ${user.lastName}`;
});

// Ensure virtual fields are included in JSON output
UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });