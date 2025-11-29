import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Attachment } from 'src/modules/attachment/schema/attachment.schema';
import { User } from 'src/modules/user/schema/user.schema';

export enum IDE_TYPE {
  DONE = 'DONE',
  WAITING = 'WAITING',
  DRAFT = 'DRAFT',
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
  carteAutoEntrepreneur: Attachment;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Attachment.name })
  nif: Attachment;

  @Prop({ type: String, enum: Object.values(IDE_TYPE), default: IDE_TYPE.DRAFT })
  status: IDE_TYPE;

  // Certification status (separate from verification status)
  @Prop({ type: String, enum: Object.values(IDE_TYPE), default: IDE_TYPE.DRAFT })
  certificationStatus: IDE_TYPE;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Attachment.name })
  nis: Attachment;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Attachment.name })
  last3YearsBalanceSheet: Attachment;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Attachment.name })
  certificates: Attachment;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Attachment.name })
  identityCard: Attachment;

  // CONDITIONALLY REQUIRED FIELDS FOR PROFESSIONALS
  // Either (registreCommerceCarteAuto + nifRequired) OR carteFellah must be provided
  // Validation is done in the controller, not in schema
  @Prop({ 
    type: MongooseSchema.Types.ObjectId, 
    ref: Attachment.name,
  })
  registreCommerceCarteAuto: Attachment; // Registre de commerce/carte auto-entrepreneur/agrément/carte d'artisan agrément (RC/autres)

  @Prop({ 
    type: MongooseSchema.Types.ObjectId, 
    ref: Attachment.name,
  })
  nifRequired: Attachment; // NIF/N° articles (NIF or Numero d'article)

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

  // NEW: Add post occupé field (optional)
  @Prop({ type: String, required: false })
  postOccupé?: string;
}

export type IdentityDocument = HydratedDocument<Identity> & {
  createdAt: Date;
  updatedAt: Date;
};
export const IdentitySchema = SchemaFactory.createForClass(Identity);

// Add custom validation for conditionally required fields
IdentitySchema.pre('save', function(next) {
  // Skip validation if status is DRAFT - documents can be uploaded incrementally
  // Validation will happen when user clicks "Soumettre" (status changes to WAITING)
  if (this.status === IDE_TYPE.DRAFT) {
    return next();
  }
  
  // Only validate for professional identity submissions when status is WAITING or DONE
  if (this.conversionType === CONVERSION_TYPE.CLIENT_TO_PROFESSIONAL || 
      this.conversionType === CONVERSION_TYPE.PROFESSIONAL_VERIFICATION) {
    
    const hasRcAndNif = this.registreCommerceCarteAuto && this.nifRequired;
    const hasCarteFellah = this.carteFellah;
    
    // Allow if either (RC + NIF) OR (Carte Fellah) is provided
    if (!hasRcAndNif && !hasCarteFellah) {
      const error = new Error('Vous devez fournir soit (RC/autres + NIF/N° articles) soit (Carte Fellah uniquement).');
      return next(error);
    }
  }
  
  next();
});