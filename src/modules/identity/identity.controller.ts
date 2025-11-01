import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Request, 
  BadRequestException, 
  UseGuards, 
  UseInterceptors, 
  UploadedFiles, 
  UploadedFile, 
  Delete, 
  Inject, 
  forwardRef, 
  Put, 
  Param, 
  Query // Added Query import
} from '@nestjs/common';
import { IdentityService } from './identity.service';
import { Types } from 'mongoose'; 
import { AuthGuard } from 'src/common/guards/auth.guard';
import { CreateIdentityDto } from './dto/create-identity.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Professional, ProfessionalDocument } from '../user/schema/pro.schema';
import { Public } from 'src/common/decorators/public.decorator';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { AttachmentAs } from 'src/modules/attachment/schema/attachment.schema';
import { AttachmentService } from '../attachment/attachment.service';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Multer } from 'multer';
import { UserService } from '../user/user.service';
import { AdminGuard } from 'src/common/guards/admin.guard';
import { Identity, IdentityDocument, IDE_TYPE, CONVERSION_TYPE } from './identity.schema'; 
import { RoleCode } from '../apikey/entity/appType.entity';

function transformAttachment(att) {
  if (!att) return null;
  return att.url ? { url: att.url, _id: att._id, filename: att.filename } : null;
}

@Controller('identities')
@UseGuards(AuthGuard)
export class IdentityController {
  constructor(
    private readonly identityService: IdentityService,
    @InjectModel(Identity.name) private identityModel: Model<IdentityDocument>,
    @InjectModel(Professional.name) private proModel: Model<ProfessionalDocument>,
    private readonly attachmentService: AttachmentService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService
  ) {}

  // UPDATED: Professional identity submission with new required fields
  @Post()
  @UseInterceptors(FileFieldsInterceptor([
    // Existing optional fields
    { name: 'commercialRegister', maxCount: 1 },
    { name: 'carteAutoEntrepreneur', maxCount: 1 },
    { name: 'nif', maxCount: 1 },
    { name: 'nis', maxCount: 1 },
    { name: 'last3YearsBalanceSheet', maxCount: 1 },
    { name: 'certificates', maxCount: 1 },
    // REQUIRED FIELDS
    { name: 'registreCommerceCarteAuto', maxCount: 1 },
    { name: 'nifRequired', maxCount: 1 },
    // OPTIONAL FIELDS (moved from required)
    { name: 'numeroArticle', maxCount: 1 },
    { name: 'c20', maxCount: 1 },
    { name: 'misesAJourCnas', maxCount: 1 },
    { name: 'carteFellah', maxCount: 1 },
  ], {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + extname(file.originalname));
      }
    })
  }))
  async createIdentity(
    @Request() req,
    @UploadedFiles() files: {
      // Existing optional fields
      commercialRegister?: Express.Multer.File[],
      carteAutoEntrepreneur?: Express.Multer.File[],
      nif?: Express.Multer.File[],
      nis?: Express.Multer.File[],
      last3YearsBalanceSheet?: Express.Multer.File[],
      certificates?: Express.Multer.File[],
      // REQUIRED FIELDS
      registreCommerceCarteAuto?: Express.Multer.File[],
      nifRequired?: Express.Multer.File[],
      // OPTIONAL FIELDS
      numeroArticle?: Express.Multer.File[],
      c20?: Express.Multer.File[],
      misesAJourCnas?: Express.Multer.File[],
      carteFellah?: Express.Multer.File[],
    }
  ): Promise<IdentityDocument> {
    const userId = req.session?.user?._id;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    // Log received files for debugging
    console.log('📁 Received files:', Object.keys(files).filter(key => files[key]?.[0]).map(key => `${key}: ${files[key][0].originalname}`));

    // Get current user to check their type
    const currentUser = await this.userService.findUserById(userId);
    if (!currentUser) {
      throw new BadRequestException('User not found');
    }

    // Check if user already has an identity
    const existingIdentity = await this.identityService.getIdentityByUser(userId);
    if (existingIdentity) {
      throw new BadRequestException('Vous avez déjà soumis vos documents d\'identité. Impossible de créer un doublon.');
    }

    const saveAttachment = async (file: Express.Multer.File) => {
      if (!file) return undefined;
      const attachment = await this.attachmentService.upload(file, AttachmentAs.IDENTITY, userId);
      return attachment._id;
    };

    // Validate required fields: Either (RC + NIF) OR (Carte Fellah only)
    const hasRcAndNif = files.registreCommerceCarteAuto?.[0] && files.nifRequired?.[0];
    const hasCarteFellah = files.carteFellah?.[0];

    console.log('🔍 Document validation check:', {
      hasRcAndNif,
      hasCarteFellah,
      registreCommerceCarteAuto: !!files.registreCommerceCarteAuto?.[0],
      nifRequired: !!files.nifRequired?.[0],
      carteFellah: !!files.carteFellah?.[0],
    });

    if (!hasRcAndNif && !hasCarteFellah) {
      console.log('❌ Validation failed: Neither (RC+NIF) nor (Carte Fellah) provided');
      throw new BadRequestException('Vous devez fournir soit (RC/autres + NIF/N° articles) soit (Carte Fellah uniquement).');
    }
    
    console.log('✅ Validation passed');


    // Handle existing optional fields
    const commercialRegisterId = files.commercialRegister?.[0] ? await saveAttachment(files.commercialRegister[0]) : undefined;
    const carteAutoEntrepreneurId = files.carteAutoEntrepreneur?.[0] ? await saveAttachment(files.carteAutoEntrepreneur[0]) : undefined;
    const nifId = files.nif?.[0] ? await saveAttachment(files.nif[0]) : undefined;
    const nisId = files.nis?.[0] ? await saveAttachment(files.nis[0]) : undefined;
    const balanceSheetId = files.last3YearsBalanceSheet?.[0] ? await saveAttachment(files.last3YearsBalanceSheet[0]) : undefined;
    const certificatesId = files.certificates?.[0] ? await saveAttachment(files.certificates[0]) : undefined;

    // Handle conditionally required fields (RC and NIF - only if provided)
    const registreCommerceCarteAutoId = files.registreCommerceCarteAuto?.[0] ? await saveAttachment(files.registreCommerceCarteAuto[0]) : undefined;
    const nifRequiredId = files.nifRequired?.[0] ? await saveAttachment(files.nifRequired[0]) : undefined;
    
    // Handle optional fields (moved from required)
    const numeroArticleId = files.numeroArticle?.[0] ? await saveAttachment(files.numeroArticle[0]) : undefined;
    const c20Id = files.c20?.[0] ? await saveAttachment(files.c20[0]) : undefined;
    const misesAJourCnasId = files.misesAJourCnas?.[0] ? await saveAttachment(files.misesAJourCnas[0]) : undefined;
    const carteFellahId = files.carteFellah?.[0] ? await saveAttachment(files.carteFellah[0]) : undefined;

    // Determine conversion type based on current user type
    let conversionType: CONVERSION_TYPE;
    let targetUserType: string;
    
    if (currentUser.type === RoleCode.PROFESSIONAL) {
      conversionType = CONVERSION_TYPE.PROFESSIONAL_VERIFICATION;
      targetUserType = RoleCode.PROFESSIONAL;
    } else if (currentUser.type === RoleCode.CLIENT) {
      conversionType = CONVERSION_TYPE.CLIENT_TO_PROFESSIONAL;
      targetUserType = RoleCode.PROFESSIONAL;
    } else {
      throw new BadRequestException('Invalid user type for professional identity submission');
    }

    const identity = await this.identityService.createIdentity(userId, {
      // Existing optional fields
      commercialRegister: commercialRegisterId as any,
      nif: nifId as any,
      nis: nisId as any,
      last3YearsBalanceSheet: balanceSheetId as any,
      certificates: certificatesId as any,
      // Required fields
      registreCommerceCarteAuto: registreCommerceCarteAutoId as any,
      nifRequired: nifRequiredId as any,
      // Optional fields (moved from required)
      numeroArticle: numeroArticleId as any,
      c20: c20Id as any,
      misesAJourCnas: misesAJourCnasId as any,
      carteFellah: carteFellahId as any,
      // Metadata
      status: IDE_TYPE.WAITING,
      conversionType,
      targetUserType,
      sourceUserType: currentUser.type,
    });

    await this.userService.updateUserFields(userId, {
      identity: identity._id,
      isHasIdentity: true,
    });

    return identity;
  }

  // Reseller identity submission (unchanged)
  @Post('reseller')
  @UseInterceptors(FileInterceptor('identityCard', {
    storage: diskStorage({
      destination: './uploads/identity',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + extname(file.originalname));
      }
    })
  }))
  async createResellerIdentity(
    @Request() req,
    @UploadedFile() identityCard: Express.Multer.File
  ): Promise<IdentityDocument> {
    const userId = req.session?.user?._id;
    
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    
    if (!identityCard) {
      throw new BadRequestException('Identity card file is required');
    }

    // Get current user to check their type
    const currentUser = await this.userService.findUserById(userId);
    if (!currentUser) {
      throw new BadRequestException('User not found');
    }

    // Only clients can become resellers through this endpoint
    if (currentUser.type !== RoleCode.CLIENT) {
      throw new BadRequestException('Only clients can become resellers through this endpoint');
    }
    
    // File validation
    if (identityCard.size === 0) {
      throw new BadRequestException('Identity card file cannot be empty');
    }
    
    if (identityCard.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Identity card file size must be less than 5MB');
    }
    
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(identityCard.mimetype)) {
      throw new BadRequestException('Identity card must be an image (JPEG, PNG, GIF) or PDF file');
    }

    try {
      // Check if user already has an identity
      const existingIdentity = await this.identityService.getIdentityByUser(userId);
      if (existingIdentity) {
        throw new BadRequestException('User already has an identity record. Cannot create duplicate.');
      }

      // Upload the identity card file
      const attachment = await this.attachmentService.upload(identityCard, AttachmentAs.IDENTITY, userId);

      // Create identity record with correct conversion type
      const identity = await this.identityService.createIdentity(userId, {
        identityCard: attachment._id as any,
        status: IDE_TYPE.WAITING,
        conversionType: CONVERSION_TYPE.CLIENT_TO_RESELLER,
        targetUserType: RoleCode.RESELLER,
        sourceUserType: currentUser.type,
      });

      // Update user to mark that they have identity
      await this.userService.updateUserFields(userId, {
        identity: identity._id,
        isHasIdentity: true,
      });

      return identity;
    } catch (error) {
      console.error('Error in createResellerIdentity:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to create reseller identity: ${error.message}`);
    }
  }

  // NEW: Client to Professional conversion endpoint with required fields
  @Post('professional')
  @UseInterceptors(FileFieldsInterceptor([
    // Existing optional fields
    { name: 'commercialRegister', maxCount: 1 },
    { name: 'carteAutoEntrepreneur', maxCount: 1 },
    { name: 'nif', maxCount: 1 },
    { name: 'nis', maxCount: 1 },
    { name: 'last3YearsBalanceSheet', maxCount: 1 },
    { name: 'certificates', maxCount: 1 },
    // REQUIRED FIELDS
    { name: 'registreCommerceCarteAuto', maxCount: 1 },
    { name: 'nifRequired', maxCount: 1 },
    // OPTIONAL FIELDS (moved from required)
    { name: 'numeroArticle', maxCount: 1 },
    { name: 'c20', maxCount: 1 },
    { name: 'misesAJourCnas', maxCount: 1 },
    { name: 'carteFellah', maxCount: 1 },
  ], {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + extname(file.originalname));
      }
    })
  }))
  async createProfessionalIdentity(
    @Request() req,
    @Body() body: { plan?: string },
    @UploadedFiles() files: {
      // Existing optional fields
      commercialRegister?: Express.Multer.File[],
      carteAutoEntrepreneur?: Express.Multer.File[],
      nif?: Express.Multer.File[],
      nis?: Express.Multer.File[],
      last3YearsBalanceSheet?: Express.Multer.File[],
      certificates?: Express.Multer.File[],
      // REQUIRED FIELDS
      registreCommerceCarteAuto?: Express.Multer.File[],
      nifRequired?: Express.Multer.File[],
      // OPTIONAL FIELDS
      numeroArticle?: Express.Multer.File[],
      c20?: Express.Multer.File[],
      misesAJourCnas?: Express.Multer.File[],
      carteFellah?: Express.Multer.File[],
    }
  ): Promise<IdentityDocument> {
    const userId = req.session?.user?._id;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    // Get current user to check their type
    const currentUser = await this.userService.findUserById(userId);
    if (!currentUser) {
      throw new BadRequestException('User not found');
    }

    // Only clients can become professionals through this endpoint
    if (currentUser.type !== RoleCode.CLIENT) {
      throw new BadRequestException('Only clients can become professionals through this endpoint');
    }

    // Check if user already has an identity
    const existingIdentity = await this.identityService.getIdentityByUser(userId);
    if (existingIdentity) {
      throw new BadRequestException('Vous avez déjà soumis vos documents d\'identité. Impossible de créer un doublon.');
    }

    const saveAttachment = async (file: Express.Multer.File) => {
      if (!file) return undefined;
      const attachment = await this.attachmentService.upload(file, AttachmentAs.IDENTITY, userId);
      return attachment._id;
    };

    // Validate required fields for professional identity (only 2 required)
    const requiredFields = ['registreCommerceCarteAuto', 'nifRequired'];
    const missingFields = [];

    for (const fieldName of requiredFields) {
      if (!files[fieldName]?.[0]) {
        missingFields.push(fieldName);
      }
    }

    if (missingFields.length > 0) {
      const fieldNames = {
        registreCommerceCarteAuto: 'Registre de commerce/carte auto-entrepreneur',
        nifRequired: 'NIF',
      };
      const missingFieldNames = missingFields.map(field => fieldNames[field]).join(', ');
      throw new BadRequestException(`Les documents suivants sont requis: ${missingFieldNames}`);
    }

    // Handle existing optional file uploads
    const commercialRegisterId = files.commercialRegister?.[0] ? await saveAttachment(files.commercialRegister[0]) : undefined;
    const carteAutoEntrepreneurId = files.carteAutoEntrepreneur?.[0] ? await saveAttachment(files.carteAutoEntrepreneur[0]) : undefined;
    const nifId = files.nif?.[0] ? await saveAttachment(files.nif[0]) : undefined;
    const nisId = files.nis?.[0] ? await saveAttachment(files.nis[0]) : undefined;
    const balanceSheetId = files.last3YearsBalanceSheet?.[0] ? await saveAttachment(files.last3YearsBalanceSheet[0]) : undefined;
    const certificatesId = files.certificates?.[0] ? await saveAttachment(files.certificates[0]) : undefined;

    // Handle required fields
    const registreCommerceCarteAutoId = await saveAttachment(files.registreCommerceCarteAuto[0]);
    const nifRequiredId = await saveAttachment(files.nifRequired[0]);
    
    // Handle optional fields (moved from required)
    const numeroArticleId = files.numeroArticle?.[0] ? await saveAttachment(files.numeroArticle[0]) : undefined;
    const c20Id = files.c20?.[0] ? await saveAttachment(files.c20[0]) : undefined;
    const misesAJourCnasId = files.misesAJourCnas?.[0] ? await saveAttachment(files.misesAJourCnas[0]) : undefined;
    const carteFellahId = files.carteFellah?.[0] ? await saveAttachment(files.carteFellah[0]) : undefined;

    // Create identity record with CLIENT_TO_PROFESSIONAL conversion type
    const identity = await this.identityService.createIdentity(userId, {
      // Existing optional fields
      commercialRegister: commercialRegisterId as any,
      nif: nifId as any,
      nis: nisId as any,
      last3YearsBalanceSheet: balanceSheetId as any,
      certificates: certificatesId as any,
      // Required fields
      registreCommerceCarteAuto: registreCommerceCarteAutoId as any,
      nifRequired: nifRequiredId as any,
      // Optional fields (moved from required)
      numeroArticle: numeroArticleId as any,
      c20: c20Id as any,
      misesAJourCnas: misesAJourCnasId as any,
      carteFellah: carteFellahId as any,
      // Metadata
      status: IDE_TYPE.WAITING,
      conversionType: CONVERSION_TYPE.CLIENT_TO_PROFESSIONAL,
      targetUserType: RoleCode.PROFESSIONAL,
      sourceUserType: currentUser.type,
    });

    // Handle subscription plan if provided
    if (body.plan) {
      try {
        await this.userService.createSubscriptionPlan(userId, body.plan);
      } catch (subscriptionError) {
        console.log('Subscription plan creation failed, trying to update:', subscriptionError.message);
        await this.userService.updateSubscriptionPlan(userId, body.plan);
      }
    }

    await this.userService.updateUserFields(userId, {
      identity: identity._id,
      isHasIdentity: true,
    });

    return identity;
  }

  // UPDATED: Admin verification endpoint with proper user type handling
  @Put(':id/verify')
  @UseGuards(AdminGuard)
  async verifyIdentity(
    @Param('id') identityId: string,
    @Body() body: { action: 'accept' | 'reject' }
  ) {
    const { action } = body;
    
    if (!action || !['accept', 'reject'].includes(action)) {
      throw new BadRequestException('Action must be either "accept" or "reject"');
    }

    try {
      // Get the identity with user details
      const identity = await this.identityService.getIdentityById(identityId);
      if (!identity) {
        throw new BadRequestException('Identity not found');
      }

      const userId = identity.user._id || identity.user;
      const user = await this.userService.findUserById(userId.toString());
      
      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Update identity status
      const newStatus = action === 'accept' ? IDE_TYPE.DONE : IDE_TYPE.REJECTED;
      await this.identityService.updateIdentityStatus(identityId, newStatus);

      // Handle user type changes based on conversion type
      if (action === 'accept') {
        switch (identity.conversionType) {
          case CONVERSION_TYPE.CLIENT_TO_RESELLER:
            // CLIENT becoming RESELLER
            await this.userService.updateUserFields(userId.toString(), {
              type: RoleCode.RESELLER,
              isVerified: true,
              rate: Math.min(10, (user.rate || 3) + 2)
            });
            break;
            
          case CONVERSION_TYPE.CLIENT_TO_PROFESSIONAL:
            // CLIENT becoming PROFESSIONAL
            await this.userService.updateUserFields(userId.toString(), {
              type: RoleCode.PROFESSIONAL,
              isVerified: true,
            });
            break;
            
          case CONVERSION_TYPE.PROFESSIONAL_VERIFICATION:
            // PROFESSIONAL staying PROFESSIONAL but verified
            await this.userService.updateUserFields(userId.toString(), {
              isVerified: true,
            });
            break;
            
          default:
            // Fallback for old records without conversionType
            if (user.type === RoleCode.CLIENT) {
              // Assume CLIENT to RESELLER for old records with identity card only
              const hasOnlyIdentityCard = identity.identityCard && 
                !identity.commercialRegister && 
                !identity.nif && 
                !identity.nis;
                
              if (hasOnlyIdentityCard) {
                await this.userService.updateUserFields(userId.toString(), {
                  type: RoleCode.RESELLER,
                  isVerified: true,
                  rate: Math.min(10, (user.rate || 3) + 2)
                });
              } else {
                // Has professional documents, assume CLIENT to PROFESSIONAL
                await this.userService.updateUserFields(userId.toString(), {
                  type: RoleCode.PROFESSIONAL,
                  isVerified: true,
                });
              }
            } else if (user.type === RoleCode.PROFESSIONAL) {
              await this.userService.updateUserFields(userId.toString(), {
                isVerified: true,
              });
            }
        }
      } else {
        // Rejection - mark as not verified but keep original type
        await this.userService.updateUserFields(userId.toString(), {
          isVerified: false,
        });
      }

      return {
        success: true,
        message: `Identity ${action}ed successfully`,
        identity: await this.identityService.getIdentityById(identityId)
      };
    } catch (error) {
      console.error('Error verifying identity:', error);
      throw new BadRequestException(`Failed to ${action} identity: ${error.message}`);
    }
  }

  // Get pending professionals
  @Get('pending/professionals')
  @UseGuards(AdminGuard)
  async getPendingProfessionals(): Promise<any[]> {
    const identities = await this.identityService.getIdentitiesByConversionType([
      CONVERSION_TYPE.PROFESSIONAL_VERIFICATION,
      CONVERSION_TYPE.CLIENT_TO_PROFESSIONAL
    ]);
    return identities.map(identity => ({
      ...JSON.parse(JSON.stringify(identity)),
      commercialRegister: transformAttachment(identity.commercialRegister),
      nif: transformAttachment(identity.nif),
      nis: transformAttachment(identity.nis),
      last3YearsBalanceSheet: transformAttachment(identity.last3YearsBalanceSheet),
      certificates: transformAttachment(identity.certificates),
      identityCard: transformAttachment(identity.identityCard),
      // NEW FIELDS
      registreCommerceCarteAuto: transformAttachment(identity.registreCommerceCarteAuto),
      nifRequired: transformAttachment(identity.nifRequired),
      numeroArticle: transformAttachment(identity.numeroArticle),
      c20: transformAttachment(identity.c20),
      misesAJourCnas: transformAttachment(identity.misesAJourCnas),
      carteFellah: transformAttachment(identity.carteFellah),
      // NEW PAYMENT PROOF FIELD
      paymentProof: transformAttachment(identity.paymentProof),
    }));
  }

  // Get pending resellers
  @Get('pending/resellers')
  @UseGuards(AdminGuard)
  async getPendingResellers(): Promise<any[]> {
    const identities = await this.identityService.getIdentitiesByConversionType([
      CONVERSION_TYPE.CLIENT_TO_RESELLER
    ]);
    return identities.map(identity => ({
      ...JSON.parse(JSON.stringify(identity)),
      identityCard: transformAttachment(identity.identityCard),
      // NEW PAYMENT PROOF FIELD
      paymentProof: transformAttachment(identity.paymentProof),
    }));
  }

  // Get all identities
  @Get()
  @UseGuards(AdminGuard)
  async getIdentities(): Promise<any[]> { 
    const identities = await this.identityService.getAllIdentities();
    return identities.map(identity => ({
      ...JSON.parse(JSON.stringify(identity)),
      commercialRegister: transformAttachment(identity.commercialRegister),
      nif: transformAttachment(identity.nif),
      nis: transformAttachment(identity.nis),
      last3YearsBalanceSheet: transformAttachment(identity.last3YearsBalanceSheet),
      certificates: transformAttachment(identity.certificates),
      identityCard: transformAttachment(identity.identityCard),
      // NEW FIELDS
      registreCommerceCarteAuto: transformAttachment(identity.registreCommerceCarteAuto),
      nifRequired: transformAttachment(identity.nifRequired),
      numeroArticle: transformAttachment(identity.numeroArticle),
      c20: transformAttachment(identity.c20),
      misesAJourCnas: transformAttachment(identity.misesAJourCnas),
      carteFellah: transformAttachment(identity.carteFellah),
      // NEW PAYMENT PROOF FIELD
      paymentProof: transformAttachment(identity.paymentProof),
    }));
  }

  // Get pending identities
  @Get('pending')
  @UseGuards(AdminGuard)
  async getPendingIdentities(): Promise<any[]> {
    const identities = await this.identityService.getIdentitiesByStatus(IDE_TYPE.WAITING);
    return identities.map(identity => ({
      ...JSON.parse(JSON.stringify(identity)),
      commercialRegister: transformAttachment(identity.commercialRegister),
      nif: transformAttachment(identity.nif),
      nis: transformAttachment(identity.nis),
      last3YearsBalanceSheet: transformAttachment(identity.last3YearsBalanceSheet),
      certificates: transformAttachment(identity.certificates),
      identityCard: transformAttachment(identity.identityCard),
      // NEW FIELDS
      registreCommerceCarteAuto: transformAttachment(identity.registreCommerceCarteAuto),
      nifRequired: transformAttachment(identity.nifRequired),
      numeroArticle: transformAttachment(identity.numeroArticle),
      c20: transformAttachment(identity.c20),
      misesAJourCnas: transformAttachment(identity.misesAJourCnas),
      carteFellah: transformAttachment(identity.carteFellah),
      // NEW PAYMENT PROOF FIELD
      paymentProof: transformAttachment(identity.paymentProof),
    }));
  }

  // Get accepted identities
  @Get('accepted')
  @UseGuards(AdminGuard)
  async getAcceptedIdentities(): Promise<any[]> {
    const identities = await this.identityService.getIdentitiesByStatus(IDE_TYPE.DONE);
    return identities.map(identity => ({
      ...JSON.parse(JSON.stringify(identity)),
      commercialRegister: transformAttachment(identity.commercialRegister),
      nif: transformAttachment(identity.nif),
      nis: transformAttachment(identity.nis),
      last3YearsBalanceSheet: transformAttachment(identity.last3YearsBalanceSheet),
      certificates: transformAttachment(identity.certificates),
      identityCard: transformAttachment(identity.identityCard),
      // NEW FIELDS
      registreCommerceCarteAuto: transformAttachment(identity.registreCommerceCarteAuto),
      nifRequired: transformAttachment(identity.nifRequired),
      numeroArticle: transformAttachment(identity.numeroArticle),
      c20: transformAttachment(identity.c20),
      misesAJourCnas: transformAttachment(identity.misesAJourCnas),
      carteFellah: transformAttachment(identity.carteFellah),
      // NEW PAYMENT PROOF FIELD
      paymentProof: transformAttachment(identity.paymentProof),
    }));
  }

  // Get rejected identities
  @Get('rejected')
  @UseGuards(AdminGuard)
  async getRejectedIdentities(): Promise<any[]> {
    const identities = await this.identityService.getIdentitiesByStatus(IDE_TYPE.REJECTED);
    return identities.map(identity => ({
      ...JSON.parse(JSON.stringify(identity)),
      commercialRegister: transformAttachment(identity.commercialRegister),
      nif: transformAttachment(identity.nif),
      nis: transformAttachment(identity.nis),
      last3YearsBalanceSheet: transformAttachment(identity.last3YearsBalanceSheet),
      certificates: transformAttachment(identity.certificates),
      identityCard: transformAttachment(identity.identityCard),
      // NEW FIELDS
      registreCommerceCarteAuto: transformAttachment(identity.registreCommerceCarteAuto),
      nifRequired: transformAttachment(identity.nifRequired),
      numeroArticle: transformAttachment(identity.numeroArticle),
      c20: transformAttachment(identity.c20),
      misesAJourCnas: transformAttachment(identity.misesAJourCnas),
      carteFellah: transformAttachment(identity.carteFellah),
      // NEW PAYMENT PROOF FIELD
      paymentProof: transformAttachment(identity.paymentProof),
    }));
  }

  // Delete a specific document from an identity (MUST be before @Delete(':id'))
  @Delete(':id/documents/:field')
  @UseGuards(AdminGuard)
  async deleteDocument(@Param('id') identityId: string, @Param('field') field: string): Promise<any> {
    try {
      const identity = await this.identityService.getIdentityById(identityId);
      if (!identity) {
        throw new BadRequestException('Identity not found');
      }

      // Validate field name
      const allowedFields = [
        'commercialRegister', 'nif', 'nis', 'last3YearsBalanceSheet', 
        'certificates', 'identityCard', 'registreCommerceCarteAuto', 
        'nifRequired', 'numeroArticle', 'c20', 'misesAJourCnas', 
        'carteFellah', 'paymentProof'
      ];

      if (!allowedFields.includes(field)) {
        throw new BadRequestException('Invalid field name');
      }

      // Set the field to null/undefined
      const updateData: any = { [field]: null };
      await this.identityModel.findByIdAndUpdate(identityId, { $unset: updateData }).exec();

      const updatedIdentity = await this.identityService.getIdentityById(identityId);
      if (!updatedIdentity) {
        throw new BadRequestException('Failed to update identity after document deletion');
      }

      // Transform the response
      const response = {
        ...JSON.parse(JSON.stringify(updatedIdentity)),
        commercialRegister: transformAttachment(updatedIdentity.commercialRegister),
        nif: transformAttachment(updatedIdentity.nif),
        nis: transformAttachment(updatedIdentity.nis),
        last3YearsBalanceSheet: transformAttachment(updatedIdentity.last3YearsBalanceSheet),
        certificates: transformAttachment(updatedIdentity.certificates),
        identityCard: transformAttachment(updatedIdentity.identityCard),
        registreCommerceCarteAuto: transformAttachment(updatedIdentity.registreCommerceCarteAuto),
        nifRequired: transformAttachment(updatedIdentity.nifRequired),
        numeroArticle: transformAttachment(updatedIdentity.numeroArticle),
        c20: transformAttachment(updatedIdentity.c20),
        misesAJourCnas: transformAttachment(updatedIdentity.misesAJourCnas),
        carteFellah: transformAttachment(updatedIdentity.carteFellah),
        paymentProof: transformAttachment(updatedIdentity.paymentProof),
      };

      return {
        success: true,
        data: response,
        message: 'Document deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting identity document:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to delete document: ${error.message}`);
    }
  }

  // Delete a single identity by ID
  @Delete(':id')
  @UseGuards(AdminGuard)
  async deleteIdentity(@Param('id') id: string) {
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid identity ID: ${id}`);
    }

    const identity = await this.identityService.getIdentityById(id);
    if (!identity) {
      // If identity doesn't exist, consider it already deleted
      // Return success to prevent errors when deleting already-deleted items
      return { 
        success: true,
        message: 'Identity not found or already deleted.',
        deletedCount: 0
      };
    }

    await this.identityService.deleteIdentity(id);
    return { 
      success: true,
      message: 'Identity deleted successfully.',
      deletedCount: 1
    };
  }

  // Delete multiple identities - UPDATED to use query parameters
  @Delete()
  @UseGuards(AdminGuard)
  async deleteIdentities(@Query('ids') ids: string | string[]) {
    // Handle both single ID string and array of IDs
    const idArray = Array.isArray(ids) ? ids : [ids];
    
    if (idArray.length === 0 || (idArray.length === 1 && !idArray[0])) {
      throw new BadRequestException('At least one identity ID must be provided for deletion.');
    }

    // Validate that all IDs are valid MongoDB ObjectIds
    for (const id of idArray) {
      if (!id || !Types.ObjectId.isValid(id)) {
        throw new BadRequestException(`Invalid identity ID: ${id}`);
      }
    }

    const result = await this.identityService.deleteIdentities(idArray);
    return { message: `${result.deletedCount} identities deleted successfully.` };
  }

  // Mark identity's user as certified (Admin only)
  @Put(':id/certify')
  @UseGuards(AdminGuard)
  async certifyIdentity(@Param('id') id: string) {
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid identity ID: ${id}`);
    }

    const identity = await this.identityService.getIdentityById(id);
    if (!identity) {
      throw new BadRequestException('Identity not found');
    }

    await this.identityService.setUserCertified(identity);
    return { success: true, message: 'User certified successfully' };
  }

  // Get current user's identity
  @Get('me')
  async getMyIdentity(@Request() req): Promise<any | null> { 
    const userId = req.session?.user?._id;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    const identity = await this.identityService.getIdentityByUser(userId);
    if (!identity) return null;
    return {
      ...JSON.parse(JSON.stringify(identity)),
      commercialRegister: transformAttachment(identity.commercialRegister),
      nif: transformAttachment(identity.nif),
      nis: transformAttachment(identity.nis),
      last3YearsBalanceSheet: transformAttachment(identity.last3YearsBalanceSheet),
      certificates: transformAttachment(identity.certificates),
      identityCard: transformAttachment(identity.identityCard),
      // NEW FIELDS
      registreCommerceCarteAuto: transformAttachment(identity.registreCommerceCarteAuto),
      nifRequired: transformAttachment(identity.nifRequired),
      numeroArticle: transformAttachment(identity.numeroArticle),
      c20: transformAttachment(identity.c20),
      misesAJourCnas: transformAttachment(identity.misesAJourCnas),
      carteFellah: transformAttachment(identity.carteFellah),
      // NEW PAYMENT PROOF FIELD
      paymentProof: transformAttachment(identity.paymentProof),
    };
  }

  // Get user documents by user ID (for admin)
  @Get('user/:userId')
  @UseGuards(AdminGuard)
  async getUserDocuments(@Param('userId') userId: string): Promise<any | null> { 
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    const identity = await this.identityService.getIdentityByUser(userId);
    if (!identity) return null;
    
    return {
      ...JSON.parse(JSON.stringify(identity)),
      commercialRegister: transformAttachment(identity.commercialRegister),
      nif: transformAttachment(identity.nif),
      nis: transformAttachment(identity.nis),
      last3YearsBalanceSheet: transformAttachment(identity.last3YearsBalanceSheet),
      certificates: transformAttachment(identity.certificates),
      identityCard: transformAttachment(identity.identityCard),
      // NEW FIELDS
      registreCommerceCarteAuto: transformAttachment(identity.registreCommerceCarteAuto),
      nifRequired: transformAttachment(identity.nifRequired),
      numeroArticle: transformAttachment(identity.numeroArticle),
      c20: transformAttachment(identity.c20),
      misesAJourCnas: transformAttachment(identity.misesAJourCnas),
      carteFellah: transformAttachment(identity.carteFellah),
      // NEW PAYMENT PROOF FIELD
      paymentProof: transformAttachment(identity.paymentProof),
    };
  }

  // Get identity by ID
  @Get(':id')
  @UseGuards(AdminGuard)
  async getIdentityById(@Param('id') id: string): Promise<any | null> { 
    if (!id) {
      throw new BadRequestException('Identity ID is required');
    }
    const identity = await this.identityService.getIdentityById(id);
    if (!identity) return null;
    
    // Debug logging for payment proof
    console.log('🔍 Server - Identity details for ID:', id);
    console.log('🔍 Server - Payment proof raw data:', identity.paymentProof);
    console.log('🔍 Server - Payment proof transformed:', transformAttachment(identity.paymentProof));
    
    return {
      ...JSON.parse(JSON.stringify(identity)),
      commercialRegister: transformAttachment(identity.commercialRegister),
      nif: transformAttachment(identity.nif),
      nis: transformAttachment(identity.nis),
      last3YearsBalanceSheet: transformAttachment(identity.last3YearsBalanceSheet),
      certificates: transformAttachment(identity.certificates),
      identityCard: transformAttachment(identity.identityCard),
      // NEW FIELDS
      registreCommerceCarteAuto: transformAttachment(identity.registreCommerceCarteAuto),
      nifRequired: transformAttachment(identity.nifRequired),
      numeroArticle: transformAttachment(identity.numeroArticle),
      c20: transformAttachment(identity.c20),
      misesAJourCnas: transformAttachment(identity.misesAJourCnas),
      carteFellah: transformAttachment(identity.carteFellah),
      // NEW PAYMENT PROOF FIELD
      paymentProof: transformAttachment(identity.paymentProof),
    };
  }

  // Update payment proof for an identity
  @Put(':id/payment-proof')
  @UseInterceptors(FileInterceptor('paymentProof', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + extname(file.originalname));
      }
    })
  }))
  async updatePaymentProof(
    @Param('id') identityId: string,
    @UploadedFile() paymentProofFile: Express.Multer.File,
    @Request() req
  ): Promise<any> {
    const userId = req.session?.user?._id;
    console.log('Payment proof upload - User ID:', userId);
    console.log('Payment proof upload - Identity ID:', identityId);
    console.log('Payment proof upload - File:', paymentProofFile?.originalname);
    
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    if (!paymentProofFile) {
      throw new BadRequestException('Payment proof file is required');
    }

    // File validation
    if (paymentProofFile.size === 0) {
      throw new BadRequestException('Payment proof file cannot be empty');
    }
    
    if (paymentProofFile.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Payment proof file size must be less than 5MB');
    }
    
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(paymentProofFile.mimetype)) {
      throw new BadRequestException('Payment proof must be an image (JPEG, PNG, GIF) or PDF file');
    }

    try {
      // Upload the payment proof file
      const attachment = await this.attachmentService.upload(paymentProofFile, AttachmentAs.IDENTITY, userId);

      // Update the identity with the payment proof
      const updatedIdentity = await this.identityService.updatePaymentProof(identityId, attachment._id.toString());

      if (!updatedIdentity) {
        throw new BadRequestException('Identity not found');
      }

      // Debug logging for payment proof upload
      console.log('🔍 Server - Payment proof upload successful for identity:', identityId);
      console.log('🔍 Server - Attachment created:', attachment);
      console.log('🔍 Server - Updated identity payment proof:', updatedIdentity.paymentProof);

      return {
        success: true,
        message: 'Payment proof updated successfully',
        identity: {
          ...JSON.parse(JSON.stringify(updatedIdentity)),
          paymentProof: transformAttachment(updatedIdentity.paymentProof),
        }
      };
    } catch (error) {
      console.error('Error updating payment proof:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to update payment proof: ${error.message}`);
    }
  }

  // Update identity document
  @Put(':id/update-document')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = extname(file.originalname);
        cb(null, `${uniqueSuffix}${ext}`);
      },
    }),
    fileFilter: (req, file, cb) => {
      const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new BadRequestException('Invalid file type. Only JPG, PNG, and PDF files are allowed.'), false);
      }
    },
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
  }))
  async updateDocument(
    @Param('id') identityId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { field: string },
    @Request() req
  ): Promise<any> {
    try {
      if (!file) {
        throw new BadRequestException('No file uploaded');
      }

      if (!body.field) {
        throw new BadRequestException('Field name is required');
      }

      // Validate field name
      const allowedFields = [
        'commercialRegister', 'nif', 'nis', 'last3YearsBalanceSheet', 
        'certificates', 'identityCard', 'registreCommerceCarteAuto', 
        'nifRequired', 'numeroArticle', 'c20', 'misesAJourCnas', 
        'carteFellah', 'paymentProof'
      ];

      if (!allowedFields.includes(body.field)) {
        throw new BadRequestException('Invalid field name');
      }

      // Get the identity by ID
      const identity = await this.identityService.getIdentityById(identityId);
      if (!identity) {
        throw new BadRequestException('Identity not found');
      }

      // Upload the file
      const attachment = await this.attachmentService.upload(
        file,
        AttachmentAs.IDENTITY,
        (identity.user as any)._id ? (identity.user as any)._id.toString() : identity.user.toString()
      );

      // Update the identity document field
      const updatedIdentity = await this.identityService.updateIdentityDocument(
        identityId,
        body.field,
        attachment._id.toString()
      );

      if (!updatedIdentity) {
        throw new BadRequestException('Failed to update identity document');
      }

      // Transform the response
      const response = {
        ...JSON.parse(JSON.stringify(updatedIdentity)),
        commercialRegister: transformAttachment(updatedIdentity.commercialRegister),
        nif: transformAttachment(updatedIdentity.nif),
        nis: transformAttachment(updatedIdentity.nis),
        last3YearsBalanceSheet: transformAttachment(updatedIdentity.last3YearsBalanceSheet),
        certificates: transformAttachment(updatedIdentity.certificates),
        identityCard: transformAttachment(updatedIdentity.identityCard),
        registreCommerceCarteAuto: transformAttachment(updatedIdentity.registreCommerceCarteAuto),
        nifRequired: transformAttachment(updatedIdentity.nifRequired),
        numeroArticle: transformAttachment(updatedIdentity.numeroArticle),
        c20: transformAttachment(updatedIdentity.c20),
        misesAJourCnas: transformAttachment(updatedIdentity.misesAJourCnas),
        carteFellah: transformAttachment(updatedIdentity.carteFellah),
        paymentProof: transformAttachment(updatedIdentity.paymentProof),
      };

      return {
        success: true,
        data: response,
        message: 'Document updated successfully'
      };
    } catch (error) {
      console.error('Error updating identity document:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to update document: ${error.message}`);
    }
  }

}