import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Attachment } from 'src/modules/attachment/schema/attachment.schema';
import { User } from 'src/modules/user/schema/user.schema';

export enum IDE_TYPE {
  DONE = 'DONE',
  WAITING = 'WAITING',
  REJECTED = 'REJECTED',
}

// NEW: Add conversion type enum
export enum CONVERSION_TYPE {
  CLIENT_TO_RESELLER = 'CLIENT_TO_RESELLER',
  CLIENT_TO_PROFESSIONAL = 'CLIENT_TO_PROFESSIONAL',
  PROFESSIONAL_VERIFICATION = 'PROFESSIONAL_VERIFICATION',
}

@Schema({ timestamps: true })
export class Identity {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true })
  user: Types.ObjectId;

  // NEW: Add conversion type field
  @Prop({ 
    type: String, 
    enum: Object.values(CONVERSION_TYPE),
    required: true 
  })
  conversionType: CONVERSION_TYPE;

  // EXISTING FIELDS - Now optional
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Attachment.name })
  commercialRegister: Attachment;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Attachment.name })
  nif: Attachment;

  @Prop({ type: String, enum: Object.values(IDE_TYPE), default: IDE_TYPE.WAITING })
  status: IDE_TYPE;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Attachment.name })
  nis: Attachment;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Attachment.name })
  last3YearsBalanceSheet: Attachment;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Attachment.name })
  certificates: Attachment;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Attachment.name })
  identityCard: Attachment;

  // NEW REQUIRED FIELDS FOR PROFESSIONALS
  @Prop({ 
    type: MongooseSchema.Types.ObjectId, 
    ref: Attachment.name,
    required: function() {
      return this.conversionType === CONVERSION_TYPE.CLIENT_TO_PROFESSIONAL || 
             this.conversionType === CONVERSION_TYPE.PROFESSIONAL_VERIFICATION;
    }
  })
  registreCommerceCarteAuto: Attachment; // Registre de commerce/carte auto-entrepreneur/agrément/carte d'artisan agrément

  @Prop({ 
    type: MongooseSchema.Types.ObjectId, 
    ref: Attachment.name,
    required: function() {
      return this.conversionType === CONVERSION_TYPE.CLIENT_TO_PROFESSIONAL || 
             this.conversionType === CONVERSION_TYPE.PROFESSIONAL_VERIFICATION;
    }
  })
  nifRequired: Attachment; // NIF (required version)

  // OPTIONAL FIELDS (moved from required)
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Attachment.name })
  numeroArticle: Attachment; // Numero d'article

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Attachment.name })
  c20: Attachment; // C20

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Attachment.name })
  misesAJourCnas: Attachment; // Mises à jour CNAS/CASNOS et CACOBAPT

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Attachment.name })
  carteFellah: Attachment; // Carte Fellah (required only for Fellah category)

  // NEW: Add target user type (what they want to become)
  @Prop({ type: String })
  targetUserType: string;

  // NEW: Add source user type (what they currently are)
  @Prop({ type: String })
  sourceUserType: string;

  // NEW: Add payment proof document field
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Attachment.name })
  paymentProof: Attachment; // Payment proof document uploaded during subscription
}

export type IdentityDocument = HydratedDocument<Identity> & {
  createdAt: Date;
  updatedAt: Date;
};
export const IdentitySchema = SchemaFactory.createForClass(Identity);