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
        status: identityData.status || IDE_TYPE.WAITING,
        // Ensure conversionType is set
        conversionType: identityData.conversionType || CONVERSION_TYPE.PROFESSIONAL_VERIFICATION
      });
      console.log('Identity model created, saving...');
      
      const savedIdentity = await identity.save();
      console.log('Identity saved successfully:', savedIdentity._id);
      
      // Create notification for admins about new identity verification
      try {
        await this.createIdentityVerificationNotification(savedIdentity);
      } catch (notificationError) {
        console.error('Error creating identity verification notification:', notificationError);
        // Don't throw error here as identity creation should still succeed
      }
      
      return savedIdentity;
    } catch (error) {
      console.error('Error creating identity:', error);
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
      .populate('user', 'firstName lastName email avatarUrl type isVerified') 
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
      // NEW PAYMENT PROOF FIELD
      .populate('paymentProof')
      .exec();
  }

  async getAllIdentities(): Promise<IdentityDocument[]> {
    return this.identityModel.find()
      .populate('user', 'firstName lastName email avatarUrl type isVerified') 
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
      // NEW PAYMENT PROOF FIELD
      .populate('paymentProof')
      .exec();
  }

  // Get identities by status
  async getIdentitiesByStatus(status: IDE_TYPE): Promise<IdentityDocument[]> {
    return this.identityModel.find({ status })
      .populate('user', 'firstName lastName email avatarUrl type isVerified') 
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
      // NEW PAYMENT PROOF FIELD
      .populate('paymentProof')
      .exec();
  }

  // Get identities by conversion type
  async getIdentitiesByConversionType(conversionTypes: CONVERSION_TYPE[]): Promise<IdentityDocument[]> {
    return this.identityModel.find({ 
      conversionType: { $in: conversionTypes },
      status: IDE_TYPE.WAITING 
    })
      .populate('user', 'firstName lastName email avatarUrl type isVerified') 
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
      .populate('user', 'firstName lastName email avatarUrl type isVerified') 
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
      // NEW PAYMENT PROOF FIELD
      .populate('paymentProof')
      .exec();
  }

  async getIdentityById(id: string): Promise<IdentityDocument | null> {
    return this.identityModel.findById(id)
      .populate('user', 'firstName lastName email avatarUrl type isVerified') 
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
      // NEW PAYMENT PROOF FIELD
      .populate('paymentProof')
      .exec();
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
      .populate('user', 'firstName lastName email avatarUrl type isVerified')
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
      .populate('user', 'firstName lastName email avatarUrl type isVerified')
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
      .populate('user', 'firstName lastName email avatarUrl type isVerified') 
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
      // NEW PAYMENT PROOF FIELD
      .populate('paymentProof')
      .exec();
      
    console.log('Payment proof update result:', result?.paymentProof);
    return result;
  }
}