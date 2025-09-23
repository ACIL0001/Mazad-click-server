import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Identity, IdentityDocument, IDE_TYPE, CONVERSION_TYPE } from './identity.schema';

@Injectable()
export class IdentityService {
  constructor(
    @InjectModel(Identity.name) private identityModel: Model<IdentityDocument>,
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
      
      return savedIdentity;
    } catch (error) {
      console.error('Error creating identity:', error);
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
      .exec();
  }
}