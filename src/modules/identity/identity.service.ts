// identity.service.ts

import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Identity, IdentityDocument, IDE_TYPE, CONVERSION_TYPE } from './identity.schema';
import { User } from '../user/schema/user.schema';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/schema/notification.schema';

@Injectable()
export class IdentityService {
  constructor(
    @InjectModel(Identity.name) private identityModel: Model<IdentityDocument>,
    @InjectModel(User.name) private userModel: Model<User>,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
  ) {}

  async createIdentity(userId: string, identityData: Partial<Identity>): Promise<IdentityDocument> {
    console.log('Creating identity with data:', { userId, identityData });
    
    try {
      const identity = new this.identityModel({ 
        ...identityData, 
        user: userId,
        status: identityData.status || IDE_TYPE.DRAFT,
        // Ensure conversionType is set
        conversionType: identityData.conversionType || CONVERSION_TYPE.PROFESSIONAL_VERIFICATION
      });
      console.log('Identity model created, saving...');
      
      const savedIdentity = await identity.save();
      console.log('Identity saved successfully:', savedIdentity._id);
      
      // Don't update verification status on creation - wait for admin approval
      // Verification status will be set after admin approves (status becomes DONE)
      
      // Create notification for admins about new identity verification
      // Only send notification if status is WAITING (submitted for review), not DRAFT
      if (savedIdentity.status === IDE_TYPE.WAITING) {
        try {
          await this.createIdentityVerificationNotification(savedIdentity);
        } catch (notificationError) {
          console.error('Error creating identity verification notification:', notificationError);
          // Don't throw error here as identity creation should still succeed
        }
      }
      
      return savedIdentity;
    } catch (error) {
      console.error('❌ Error creating identity in service:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        userId,
        identityData: {
          ...identityData,
          // Don't log full attachment objects
          registreCommerceCarteAuto: identityData.registreCommerceCarteAuto ? 'present' : 'missing',
          nifRequired: identityData.nifRequired ? 'present' : 'missing',
          carteFellah: identityData.carteFellah ? 'present' : 'missing',
        },
      });
      throw error;
    }
  }

  private async createIdentityVerificationNotification(identity: IdentityDocument): Promise<void> {
    try {
      console.log('🔔 Creating identity verification notifications...');
      
      // Get all admin users (both ADMIN and SOUS_ADMIN)
      const adminUsers = await this.userModel.find({
        type: { $in: ['ADMIN', 'SOUS_ADMIN'] }
      }).select('_id email firstName lastName type');

      console.log(`📧 Found ${adminUsers.length} admin users:`, adminUsers.map(u => ({ 
        id: u._id, 
        email: u.email, 
        type: u.type 
      })));

      if (adminUsers.length === 0) {
        console.warn('⚠️ No admin users found to send identity verification notification');
        return;
      }

      const conversionTypeLabels = {
        [CONVERSION_TYPE.PROFESSIONAL_VERIFICATION]: 'Vérification Professionnelle',
        [CONVERSION_TYPE.CLIENT_TO_PROFESSIONAL]: 'Client → Professionnel',
        [CONVERSION_TYPE.CLIENT_TO_RESELLER]: 'Client → Revendeur'
      };

      const conversionLabel = conversionTypeLabels[identity.conversionType] || 'Vérification d\'identité';
      
      // Create notification for each admin user
      const notificationPromises = adminUsers.map(adminUser => 
        this.notificationService.create(
          adminUser._id.toString(),
          NotificationType.IDENTITY_VERIFICATION,
          'Nouvelle demande de vérification d\'identité',
          `Une nouvelle demande de ${conversionLabel} a été soumise et nécessite votre attention.`,
          {
            identityId: identity._id,
            userId: identity.user,
            conversionType: identity.conversionType,
            status: identity.status,
            submittedAt: identity.createdAt
          },
          identity.user.toString(),
          'Utilisateur',
          'user@example.com'
        )
      );

      const createdNotifications = await Promise.all(notificationPromises);
      console.log(`✅ Identity verification notifications created successfully for ${adminUsers.length} admin users`);
      console.log('📝 Notification IDs:', createdNotifications.map(n => n._id));
    } catch (error) {
      console.error('Error creating identity verification notification:', error);
      throw error;
    }
  }

  async getIdentityByUser(userId: string): Promise<IdentityDocument | null> {
    return this.identityModel.findOne({ user: userId })
      .populate('user', 'firstName lastName email avatarUrl type isVerified secteur entreprise postOccupé') 
      .populate('commercialRegister')
      .populate('nif')
      .populate('nis')
      .populate('last3YearsBalanceSheet')
      .populate('certificates')
      .populate('identityCard')
      // NEW REQUIRED FIELDS
      .populate('registreCommerceCarteAuto')
      .populate('nifRequired')
      .populate('numeroArticle')
      .populate('c20')
      .populate('misesAJourCnas')
      .populate('carteFellah') // ✅ FIX: Added populate for carteFellah
      // NEW PAYMENT PROOF FIELD
      .populate('paymentProof')
      .exec();
  }

  async getAllIdentities(): Promise<IdentityDocument[]> {
    return this.identityModel.find()
      .populate('user', 'firstName lastName email avatarUrl type isVerified secteur entreprise postOccupé') 
      .populate('commercialRegister')
      .populate('nif')
      .populate('nis')
      .populate('last3YearsBalanceSheet')
      .populate('certificates')
      .populate('identityCard')
      // NEW REQUIRED FIELDS
      .populate('registreCommerceCarteAuto')
      .populate('nifRequired')
      .populate('numeroArticle')
      .populate('c20')
      .populate('misesAJourCnas')
      .populate('carteFellah') // ✅ FIX: Added populate for carteFellah
      // NEW PAYMENT PROOF FIELD
      .populate('paymentProof')
      .exec();
  }

  // Get identities by status
  async getIdentitiesByStatus(status: IDE_TYPE): Promise<IdentityDocument[]> {
    return this.identityModel.find({ status })
      .populate('user', 'firstName lastName email avatarUrl type isVerified secteur entreprise postOccupé') 
      .populate('commercialRegister')
      .populate('carteAutoEntrepreneur')
      .populate('nif')
      .populate('nis')
      .populate('last3YearsBalanceSheet')
      .populate('certificates')
      .populate('identityCard')
      // NEW REQUIRED FIELDS
      .populate('registreCommerceCarteAuto')
      .populate('nifRequired')
      .populate('numeroArticle')
      .populate('c20')
      .populate('misesAJourCnas')
      .populate('carteFellah') // ✅ FIX: Added populate for carteFellah
      // NEW PAYMENT PROOF FIELD
      .populate('paymentProof')
      .exec();
  }

  // Get identities with pending review (either verification or certification)
  async getIdentitiesWithPendingReview(): Promise<IdentityDocument[]> {
    return this.identityModel.find({
      $or: [
        { status: IDE_TYPE.WAITING },
        { certificationStatus: IDE_TYPE.WAITING }
      ]
    })
      .populate('user', 'firstName lastName email avatarUrl type isVerified secteur entreprise postOccupé') 
      .populate('commercialRegister')
      .populate('carteAutoEntrepreneur')
      .populate('nif')
      .populate('nis')
      .populate('last3YearsBalanceSheet')
      .populate('certificates')
      .populate('identityCard')
      // NEW REQUIRED FIELDS
      .populate('registreCommerceCarteAuto')
      .populate('nifRequired')
      .populate('numeroArticle')
      .populate('c20')
      .populate('misesAJourCnas')
      .populate('carteFellah')
      // NEW PAYMENT PROOF FIELD
      .populate('paymentProof')
      .exec();
  }

  // Get identities by conversion type
  async getIdentitiesByConversionType(conversionTypes: CONVERSION_TYPE[]): Promise<IdentityDocument[]> {
    return this.identityModel.find({ 
      conversionType: { $in: conversionTypes },
      $or: [
        { status: IDE_TYPE.WAITING },
        { certificationStatus: IDE_TYPE.WAITING }
      ]
    })
      .populate('user', 'firstName lastName email avatarUrl type isVerified secteur entreprise postOccupé') 
      .populate('commercialRegister')
      .populate('carteAutoEntrepreneur')
      .populate('nif')
      .populate('nis')
      .populate('last3YearsBalanceSheet')
      .populate('certificates')
      .populate('identityCard')
      // NEW REQUIRED FIELDS
      .populate('registreCommerceCarteAuto')
      .populate('nifRequired')
      .populate('numeroArticle')
      .populate('c20')
      .populate('misesAJourCnas')
      .populate('carteFellah') // ✅ FIX: Added populate for carteFellah
      // NEW PAYMENT PROOF FIELD
      .populate('paymentProof')
      .exec();
  }

  // Update identity status
  async updateIdentityStatus(identityId: string, status: IDE_TYPE): Promise<IdentityDocument | null> {
    return this.identityModel.findByIdAndUpdate(
      identityId,
      { status },
      { new: true }
    )
      .populate('user', 'firstName lastName email avatarUrl type isVerified secteur entreprise postOccupé') 
      .populate('commercialRegister')
      .populate('nif')
      .populate('nis')
      .populate('last3YearsBalanceSheet')
      .populate('certificates')
      .populate('identityCard')
      // NEW REQUIRED FIELDS
      .populate('registreCommerceCarteAuto')
      .populate('nifRequired')
      .populate('numeroArticle')
      .populate('c20')
      .populate('misesAJourCnas')
      .populate('carteFellah') // ✅ FIX: Added populate for carteFellah
  }

  async updateCertificationStatus(identityId: string, status: IDE_TYPE): Promise<IdentityDocument | null> {
    return this.identityModel.findByIdAndUpdate(
      identityId,
      { certificationStatus: status },
      { new: true }
    )
      .populate('user', 'firstName lastName email avatarUrl type isVerified secteur entreprise postOccupé') 
      .populate('commercialRegister')
      .populate('carteAutoEntrepreneur')
      .populate('nif')
      .populate('nis')
      .populate('last3YearsBalanceSheet')
      .populate('certificates')
      .populate('identityCard')
      .populate('registreCommerceCarteAuto')
      .populate('nifRequired')
      .populate('numeroArticle')
      .populate('c20')
      .populate('misesAJourCnas')
      .populate('carteFellah')
      // NEW PAYMENT PROOF FIELD
      .populate('paymentProof')
      .exec();
  }

  async getIdentityById(id: string): Promise<IdentityDocument | null> {
    return this.identityModel.findById(id)
      .populate('user', 'firstName lastName email avatarUrl type isVerified secteur entreprise postOccupé') 
      .populate('commercialRegister')
      .populate('nif')
      .populate('nis')
      .populate('last3YearsBalanceSheet')
      .populate('certificates')
      .populate('identityCard')
      // NEW REQUIRED FIELDS
      .populate('registreCommerceCarteAuto')
      .populate('nifRequired')
      .populate('numeroArticle')
      .populate('c20')
      .populate('misesAJourCnas')
      .populate('carteFellah') // ✅ FIX: Added populate for carteFellah
      // NEW PAYMENT PROOF FIELD
      .populate('paymentProof')
      .exec();
  }

  // Delete a single identity by ID
  async deleteIdentity(id: string): Promise<any> {
    return this.identityModel.findByIdAndDelete(id).exec();
  }

  // Delete multiple identities by ID
  async deleteIdentities(ids: string[]): Promise<any> {
    return this.identityModel.deleteMany({ _id: { $in: ids } }).exec();
  }

  // Get identities for pending professionals (both existing and converting clients)
  async getPendingProfessionals(): Promise<IdentityDocument[]> {
    return this.identityModel.find({ 
      status: IDE_TYPE.WAITING,
      conversionType: { $in: [CONVERSION_TYPE.PROFESSIONAL_VERIFICATION, CONVERSION_TYPE.CLIENT_TO_PROFESSIONAL] }
    })
      .populate('user', 'firstName lastName email avatarUrl type isVerified secteur entreprise postOccupé')
      .populate('commercialRegister')
      .populate('nif')
      .populate('nis')
      .populate('last3YearsBalanceSheet')
      .populate('certificates')
      .populate('identityCard')
      // NEW REQUIRED FIELDS
      .populate('registreCommerceCarteAuto')
      .populate('nifRequired')
      .populate('numeroArticle')
      .populate('c20')
      .populate('misesAJourCnas')
      .populate('carteFellah') // ✅ FIX: Added populate for carteFellah
      // NEW PAYMENT PROOF FIELD
      .populate('paymentProof')
      .exec();
  }

  // Get identities for pending resellers (clients becoming resellers)
  async getPendingResellers(): Promise<IdentityDocument[]> {
    return this.identityModel.find({ 
      status: IDE_TYPE.WAITING,
      conversionType: CONVERSION_TYPE.CLIENT_TO_RESELLER
    })
      .populate('user', 'firstName lastName email avatarUrl type isVerified secteur entreprise postOccupé')
      .populate('identityCard')
      // NEW PAYMENT PROOF FIELD
      .populate('paymentProof')
      .exec();
  }

  // Update payment proof for an identity
  async updatePaymentProof(identityId: string, paymentProofId: string): Promise<IdentityDocument | null> {
    console.log('Updating payment proof for identity:', identityId, 'with attachment:', paymentProofId);
    
    const result = await this.identityModel.findByIdAndUpdate(
      identityId,
      { paymentProof: paymentProofId },
      { new: true }
    )
      .populate('user', 'firstName lastName email avatarUrl type isVerified secteur entreprise postOccupé') 
      .populate('commercialRegister')
      .populate('nif')
      .populate('nis')
      .populate('last3YearsBalanceSheet')
      .populate('certificates')
      .populate('identityCard')
      // NEW REQUIRED FIELDS
      .populate('registreCommerceCarteAuto')
      .populate('nifRequired')
      .populate('numeroArticle')
      .populate('c20')
      .populate('misesAJourCnas')
      .populate('carteFellah') // ✅ FIX: Added populate for carteFellah
      // NEW PAYMENT PROOF FIELD
      .populate('paymentProof')
      .exec();
      
    console.log('Payment proof update result:', result?.paymentProof);
    return result;
  }

  async updateIdentityDocument(identityId: string, field: string, attachmentId: string): Promise<IdentityDocument | null> {
    console.log('Updating identity document:', { identityId, field, attachmentId });
    
    try {
      const updateData = { [field]: attachmentId };
      
      const result = await this.identityModel
        .findByIdAndUpdate(identityId, { $set: updateData }, { new: true })
        .populate('commercialRegister')
        .populate('nif')
        .populate('nis')
        .populate('last3YearsBalanceSheet')
        .populate('certificates')
        .populate('identityCard')
        .populate('registreCommerceCarteAuto')
        .populate('nifRequired')
        .populate('numeroArticle')
        .populate('c20')
        .populate('misesAJourCnas')
        .populate('carteFellah')
        .populate('paymentProof')
        .exec();
      
      console.log('Document update result:', result?.[field]);
      
      // Only update verification status if identity is already approved (DONE)
      // If status is WAITING, documents are pending admin review
      if (result && result.user && result.status === IDE_TYPE.DONE) {
        await this.updateUserVerificationStatus(result);
      }
      
      return result;
    } catch (error) {
      console.error('Error updating identity document:', error);
      throw error;
    }
  }

  // Update user verification and certification status based on identity documents
  async updateUserVerificationStatus(identity: IdentityDocument): Promise<void> {
    if (!identity || !identity.user) {
      return;
    }

    // Only update verification status if identity has been approved by admin (status is DONE)
    // Users should not be verified just by uploading documents - they need admin approval first
    if (identity.status !== IDE_TYPE.DONE) {
      console.log(`⏸️ Skipping verification status update - identity status is ${identity.status}, not DONE`);
      return;
    }

    const userId = typeof identity.user === 'string' ? identity.user : identity.user._id;
    
    try {
      // Check if required documents are present (verified status)
      // Required: (registreCommerceCarteAuto AND nifRequired) OR carteFellah
      const hasRequiredDocs = 
        (identity.registreCommerceCarteAuto && identity.nifRequired) || 
        identity.carteFellah;

      // Check if optional documents are present (certified status)
      // Optional: numeroArticle, c20, misesAJourCnas
      const hasOptionalDocs = 
        identity.numeroArticle || 
        identity.c20 || 
        identity.misesAJourCnas;

      const updateFields: any = {};

      // Mark as verified if required documents exist (baseline 3 stars)
      if (hasRequiredDocs) {
        updateFields.isVerified = true;
        updateFields.rate = 3; // baseline for verified users
      }

      // Mark as certified only if optional docs exist in addition to required docs
      // and upgrade stars to 5
      if (hasRequiredDocs && hasOptionalDocs) {
        updateFields.isCertified = true;
        updateFields.rate = 5; // upgrade to 5 stars when certified
      }

      if (Object.keys(updateFields).length > 0) {
        await this.userModel.findByIdAndUpdate(userId, { $set: updateFields });
        console.log(`✅ Updated user ${userId} verification status:`, updateFields);
      }
    } catch (error) {
      console.error('Error updating user verification status:', error);
      // Don't throw error - verification status update shouldn't fail document upload
    }
  }

  // Force set user certified (admin action)
  async setUserCertified(identity: IdentityDocument): Promise<void> {
    const userId = typeof identity.user === 'string' ? identity.user : identity.user._id;
    try {
      await this.userModel.findByIdAndUpdate(userId, { $set: { isCertified: true, isVerified: true, rate: 5 } });
    } catch (e) {
      // swallow
    }
  }
}