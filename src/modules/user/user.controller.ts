import { Controller, Get, Post, Put, UseGuards, Request, Body, Patch, Param, BadRequestException, UseInterceptors, UploadedFile, Delete } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Multer } from 'multer';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { ProtectedRequest } from 'src/types/request.type';
import { ProService } from './services/pro.service';
import { AdminService } from './services/admin.service';
import { ClientService } from './services/client.service';
import { AdminGuard } from 'src/common/guards/admin.guard';
import { UserService } from './user.service';
import { RoleCode } from '../apikey/entity/appType.entity';
import { Public } from 'src/common/decorators/public.decorator';
import { AttachmentService } from '../attachment/attachment.service';
import { AttachmentAs } from '../attachment/schema/attachment.schema';
import { IdentityService } from '../identity/identity.service';
import { IDE_TYPE, CONVERSION_TYPE } from '../identity/identity.schema';
import { User } from './schema/user.schema';

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly attachmentService: AttachmentService,
    private readonly adminService: AdminService,
    private readonly identityService: IdentityService,
  ) {}

  @Get('test')
  @Public()
  async testEndpoint() {
    return { message: 'User controller is working', timestamp: new Date().toISOString() };
  }

  @Get('dashboard-access-test')
  @UseGuards(AuthGuard)
  async testDashboardAccess(@Request() request: ProtectedRequest) {
    const user = request.session.user;
    return { 
      message: 'Dashboard access successful',
      userType: user.type,
      userId: user._id,
      allowedRoles: ['CLIENT', 'PROFESSIONAL', 'RESELLER'],
      isAllowed: ['CLIENT', 'PROFESSIONAL', 'RESELLER'].includes(user.type),
      timestamp: new Date().toISOString()
    };
  }

  @Get('/me')
  @UseGuards(AuthGuard)
  async getUser(@Request() request: ProtectedRequest) {
    // Always return fresh user data from database
    const userId = request.session.user._id.toString();
    const freshUser = await this.userService.findUserById(userId);
    
    if (!freshUser) {
      throw new BadRequestException('User not found');
    }

    return {
      success: true,
      user: freshUser,
      data: freshUser // Include both formats for compatibility
    };
  }

  @Put('/me')
  @UseGuards(AuthGuard)
  async updateProfile(@Request() req: ProtectedRequest, @Body() updateData: any) {
    const userId = req.session.user._id.toString();
    
    // Validate input data
    const allowedFields = ['firstName', 'lastName', 'phone'];
    const filteredData = {};
    
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    }

    if (Object.keys(filteredData).length === 0) {
      throw new BadRequestException('No valid fields to update');
    }

    console.log('Updating user profile:', { userId, updateData: filteredData });

    // Update the user
    const updatedUser = await this.userService.updateUserFields(userId, filteredData);
    
    if (!updatedUser) {
      throw new BadRequestException('Failed to update user profile');
    }

    // Return fresh user data from database to ensure consistency
    const freshUser = await this.userService.findUserById(userId);

    return {
      success: true,
      message: 'Profile updated successfully',
      user: freshUser,
      data: freshUser // Include both formats for compatibility
    };
  }

  @Post('/me/avatar')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('avatar', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + extname(file.originalname));
      },
    }),
  }))
  async updateAvatar(
    @Request() req: ProtectedRequest,
    @UploadedFile() avatar: Express.Multer.File
  ) {
    if (!avatar) {
      throw new BadRequestException('Avatar file is required');
    }

    const userId = req.session.user._id.toString();

    console.log('Updating avatar for user:', userId);

    try {
      // Check if user already has an avatar attachment
      const existingAvatar = await this.attachmentService.findByUserAndType(userId, AttachmentAs.AVATAR);

      let attachment;
      if (existingAvatar) {
        console.log('Updating existing avatar attachment:', existingAvatar._id);
        attachment = await this.attachmentService.updateAttachment(existingAvatar._id.toString(), avatar, userId);
      } else {
        console.log('Creating new avatar attachment');
        attachment = await this.attachmentService.upload(avatar, AttachmentAs.AVATAR, userId);

        await this.userService.updateUserFields(userId, {
          avatar: attachment._id as any
        });
      }

      // Always return fresh user data from database
      const userWithAvatar = await this.userService.findUserById(userId);

      if (!userWithAvatar) {
        throw new BadRequestException('Failed to fetch updated user data');
      }

      return {
        success: true,
        message: existingAvatar ? 'Avatar updated successfully' : 'Avatar uploaded successfully',
        user: userWithAvatar,
        data: userWithAvatar, // Include both formats for compatibility
        attachment: {
          _id: attachment._id,
          url: attachment.url,
          filename: attachment.filename
        }
      };

    } catch (error) {
      console.error('Error updating avatar:', error);
      throw new BadRequestException(`Failed to update avatar: ${error.message}`);
    }
  }

  // NEW: Client to Professional conversion
  @Post('/convert-to-professional')
  @UseGuards(AuthGuard)
  async convertToProfessional(
    @Request() req: ProtectedRequest,
    @Body() conversionData: { plan?: string; paymentDetails?: any }
  ) {
    console.log('🏢 === CONVERT TO PROFESSIONAL ENDPOINT CALLED ===');
    
    const user = req.session.user;
    console.log('convertToProfessional called with user:', user);
    console.log('User type:', user.type);
    console.log('conversionData:', conversionData);

    // Validate that user is a client
    if (user.type !== RoleCode.CLIENT) {
      throw new BadRequestException('Only clients can convert to professional');
    }

    // Check if user has submitted professional identity documents
    const identity = await this.identityService.getIdentityByUser(user._id.toString());
    if (!identity) {
      throw new BadRequestException('Please submit your professional identity documents first via POST /identities/professional');
    }

    // Check if identity is of the correct type
    if (identity.conversionType !== CONVERSION_TYPE.CLIENT_TO_PROFESSIONAL) {
      throw new BadRequestException('Identity documents are not for professional conversion');
    }

    // Check if identity is approved
    if (identity.status !== IDE_TYPE.DONE) {
      throw new BadRequestException('Your professional identity documents must be approved before conversion');
    }

    try {
      const { plan, paymentDetails } = conversionData || {};

      // Handle subscription plan if provided
      if (plan) {
        try {
          await this.userService.createSubscriptionPlan(user._id.toString(), plan);
        } catch (subscriptionError) {
          console.log('Subscription plan creation failed, trying to update:', subscriptionError.message);
          await this.userService.updateSubscriptionPlan(user._id.toString(), plan);
        }
      }

      // Convert user to professional (this should already be done by identity verification, but ensure it's set)
      const updatedUser = await this.userService.updateUserFields(user._id.toString(), {
        type: RoleCode.PROFESSIONAL,
        isVerified: true,
        isHasIdentity: true
      });

      console.log('User converted to professional:', updatedUser);

      // Return fresh user data
      const freshUser = await this.userService.findUserById(user._id.toString());

      return {
        success: true,
        message: 'Congratulations! Your account has been successfully converted to a Professional account. You now have access to all professional features.',
        user: freshUser,
        data: freshUser,
        plan: plan || null,
        userTypeChanged: true,
        oldType: RoleCode.CLIENT,
        newType: RoleCode.PROFESSIONAL
      };
    } catch (error) {
      console.error('Error in professional conversion:', error);
      return {
        success: false,
        message: 'Failed to process professional conversion',
        error: error?.message || error?.toString(),
        stack: error?.stack
      };
    }
  }

  // UPDATED: Client to Reseller conversion
  @Post('/convert-to-reseller')
  @UseGuards(AuthGuard)
  async convertToReseller(
    @Request() req: ProtectedRequest,
    @Body() conversionData: { plan: string; paymentDetails: any }
  ) {
    console.log('🚀 === CONVERT TO RESELLER ENDPOINT CALLED ===');
    
    const user = req.session.user;
    console.log('convertToReseller called with user:', user);
    console.log('User type:', user.type);
    console.log('conversionData:', conversionData);

    // Validate that user is a client
    if (user.type !== RoleCode.CLIENT) {
      throw new BadRequestException('Only clients can convert to reseller');
    }

    // Check if user has submitted reseller identity documents
    const identity = await this.identityService.getIdentityByUser(user._id.toString());
    if (!identity) {
      throw new BadRequestException('Please submit your identity card first via POST /identities/reseller');
    }

    // Check if identity is of the correct type
    if (identity.conversionType !== CONVERSION_TYPE.CLIENT_TO_RESELLER) {
      throw new BadRequestException('Identity documents are not for reseller conversion');
    }

    // Check if identity is approved
    if (identity.status !== IDE_TYPE.DONE) {
      throw new BadRequestException('Your identity documents must be approved before conversion');
    }

    // Validate required data
    if (!conversionData.plan || !conversionData.paymentDetails) {
      throw new BadRequestException('Plan and payment details are required');
    }

    const { plan, paymentDetails } = conversionData;

    try {
      // Process payment (this would integrate with a real payment gateway)
      console.log('Processing payment for reseller conversion:', {
        userId: user._id,
        plan,
        amount: paymentDetails.amount
      });

      // Create or update subscription plan for the user
      let subscriptionResult;
      try {
        subscriptionResult = await this.userService.createSubscriptionPlan(user._id.toString(), plan);
      } catch (subscriptionError) {
        console.log('Subscription plan creation failed, trying to update:', subscriptionError.message);
        subscriptionResult = await this.userService.updateSubscriptionPlan(user._id.toString(), plan);
      }

      console.log('Subscription result:', subscriptionResult);

      // Update user type to RESELLER and increase rate by 2 (this should already be done by identity verification, but ensure it's set)
      const currentRate = user.rate || 1;
      const newRate = Math.min(10, currentRate + 2); // Add 2 to current rate, max 10

      const updatedUser = await this.userService.updateUserFields(user._id.toString(), {
        type: RoleCode.RESELLER,
        rate: newRate,
        isVerified: true,
        isHasIdentity: true
      });

      console.log('User updated to reseller:', updatedUser);

      // Return fresh user data
      const freshUser = await this.userService.findUserById(user._id.toString());

      return {
        success: true,
        message: `Congratulations! Your account has been successfully converted to a Reseller account. Your rating has been increased from ${currentRate} to ${newRate}. You now have access to all reseller features.`,
        user: freshUser,
        data: freshUser,
        plan: plan,
        paymentProcessed: true,
        userTypeChanged: true,
        rateUpdated: true,
        oldRate: currentRate,
        newRate: newRate
      };
    } catch (error) {
      console.error('Error in reseller conversion:', error);
      return {
        success: false,
        message: 'Failed to process reseller conversion',
        error: error?.message || error?.toString(),
        stack: error?.stack
      };
    }
  }

  // NEW: Professional identity verification (for existing professionals)
  @Post('/verify-professional-identity')
  @UseGuards(AuthGuard)
  async verifyProfessionalIdentity(@Request() req: ProtectedRequest) {
    console.log('🔍 === VERIFY PROFESSIONAL IDENTITY ENDPOINT CALLED ===');
    
    const user = req.session.user;
    console.log('verifyProfessionalIdentity called with user:', user);
    console.log('User type:', user.type);

    // Validate that user is a professional
    if (user.type !== RoleCode.PROFESSIONAL) {
      throw new BadRequestException('Only professionals can verify their identity through this endpoint');
    }

    // Check if user has submitted professional identity documents
    const identity = await this.identityService.getIdentityByUser(user._id.toString());
    if (!identity) {
      throw new BadRequestException('Please submit your professional identity documents first via POST /identities');
    }

    // Check if identity is of the correct type
    if (identity.conversionType !== CONVERSION_TYPE.PROFESSIONAL_VERIFICATION) {
      throw new BadRequestException('Identity documents are not for professional verification');
    }

    // Check if identity is approved
    if (identity.status !== IDE_TYPE.DONE) {
      throw new BadRequestException('Your professional identity documents must be approved first');
    }

    try {
      // Update user verification status (should already be done by identity verification, but ensure it's set)
      const updatedUser = await this.userService.updateUserFields(user._id.toString(), {
        isVerified: true,
        isHasIdentity: true
      });

      console.log('Professional identity verified:', updatedUser);

      // Return fresh user data
      const freshUser = await this.userService.findUserById(user._id.toString());

      return {
        success: true,
        message: 'Congratulations! Your professional identity has been successfully verified. You now have full access to all professional features.',
        user: freshUser,
        data: freshUser,
        identityVerified: true
      };
    } catch (error) {
      console.error('Error in professional identity verification:', error);
      return {
        success: false,
        message: 'Failed to process professional identity verification',
        error: error?.message || error?.toString(),
        stack: error?.stack
      };
    }
  }

  @Post('/me/reseller-identity')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('identityCard', {
    storage: diskStorage({
      destination: './uploads/identity',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + extname(file.originalname));
      },
    }),
  }))
  async uploadResellerIdentity(
    @Request() req: ProtectedRequest,
    @UploadedFile() identityCard: Express.Multer.File
  ) {
    try {
      if (!identityCard) {
        throw new BadRequestException('Identity card file is required');
      }

      const userId = req.session.user._id.toString();
      // Upload the file using attachment service
      const attachment = await this.attachmentService.upload(identityCard, AttachmentAs.IDENTITY, userId);
      // Store identity information in user's identity field (for resellers)
      const updatedUser = await this.userService.updateUserFields(userId, {
        identity: {
          identityCard: attachment._id
        },
        isHasIdentity: true
      });

      // Return fresh user data
      const freshUser = await this.userService.findUserById(userId);

      return {
        success: true,
        message: 'Identity card uploaded successfully',
        user: freshUser,
        data: freshUser,
        attachment: {
          _id: attachment._id,
          url: attachment.url,
          filename: attachment.filename
        }
      };
    } catch (error) {
      console.error('Error in uploadResellerIdentity:', error);
      return {
        success: false,
        message: 'Failed to upload identity card',
        error: error?.message || error?.toString(),
        stack: error?.stack
      };
    }
  }

  @Post('/admin')
  async createAdmin() {
    await this.adminService.initializeAdminUsers();
return { message: 'Admin users initialized successfully' };
  }

  @Post('/subscription-plan')
  @UseGuards(AuthGuard)
  async addSubscriptionPlan(@Request() req: ProtectedRequest, @Body() body: { plan: string; returnUrl?: string }) {
    // Redirect to new subscription flow
    return {
      success: false,
      message: 'Please use the new subscription endpoint: POST /subscription/create-with-payment',
      redirectTo: '/subscription/create-with-payment',
      data: body
    };
  }

  @Put('/subscription-plan')
  @UseGuards(AuthGuard)
  async updateSubscriptionPlan(@Request() req: ProtectedRequest, @Body('plan') plan: string) {
    return this.userService.updateSubscriptionPlan(req.session.user._id.toString(), plan);
  }

  @Post('/change-password')
  @UseGuards(AuthGuard)
  async changePassword(
    @Request() req: ProtectedRequest,
    @Body() data: { currentPassword: string; newPassword: string }
  ) {
    console.log('Change password request received:', { userId: req.session.user._id.toString() });
    console.log('Request data:', { currentPassword: data.currentPassword ? 'Present' : 'Missing', newPassword: data.newPassword ? 'Present' : 'Missing' });

    const userId = req.session.user._id.toString();
    const result = await this.userService.changePassword(userId, data.currentPassword, data.newPassword);
    console.log('Change password result:', result);
    
    return {
      success: true,
      message: result.message || 'Password changed successfully',
      data: result
    };
  }

  @Put('verify/:userId')
  @UseGuards(AdminGuard)
  async verifyUser(
    @Param('userId') userId: string,
    @Body('isVerified') isVerified: boolean
  ) {
    return this.userService.setUserVerified(userId, isVerified);
  }

  // ORIGINAL ENDPOINTS - Return all users by role (for admin purposes)
  @Get('/professionals')
  @Public()
  async getProfessionals() {
    console.log('Getting ALL professionals (verified and unverified)...');
    const professionals = await this.userService.findUsersByRoles([RoleCode.PROFESSIONAL]);
    console.log(`Found ${professionals.length} total professionals`);
    return professionals;
  }

  @Get('/resellers')
  @Public()
  async getResellers() {
    const roles = [RoleCode.RESELLER];
    console.log('Querying for resellers with roles:', roles);
    const resellers = await this.userService.findUsersByRoles(roles);
    console.log('Reseller users found:', resellers);
    return resellers;
  }

  // NEW ENDPOINTS - Return only verified users (identity status = DONE)
  @Get('/professionals/verified')
  @Public()
  async getVerifiedProfessionals() {
    console.log('Getting verified professionals...');
    
    try {
      // Get all accepted/done identities
      const acceptedIdentities = await this.identityService.getIdentitiesByStatus(IDE_TYPE.DONE);
      console.log('Found accepted identities:', acceptedIdentities.length);
      
      // Filter for professional users only
      const professionalIdentities = acceptedIdentities.filter(identity => 
        identity.user && (identity.user as unknown as User).type === RoleCode.PROFESSIONAL
      );
      console.log('Professional identities found:', professionalIdentities.length);
      
      // Extract user IDs and fetch full user details
      const userIds = professionalIdentities.map(identity => (identity.user as unknown as User)._id.toString());
      const professionals = await this.userService.findUsersByIds(userIds);
      
      console.log('Verified professionals found:', professionals.length);
      return professionals;
    } catch (error) {
      console.error('Error getting verified professionals:', error);
      throw new BadRequestException('Failed to fetch verified professionals');
    }
  }

  @Get('/resellers/verified')
  @Public()
  async getVerifiedResellers() {
    console.log('Getting verified resellers...');
    
    try {
      // Get all users with RESELLER type who have verified identities
      const allResellers = await this.userService.findUsersByRoles([RoleCode.RESELLER]);
      console.log('All resellers found:', allResellers.length);
      
      // Filter resellers who have verified identities (status = DONE)
      const verifiedResellers = [];
      
      for (const reseller of allResellers) {
        const identity = await this.identityService.getIdentityByUser(reseller._id.toString());
        if (identity && identity.status === IDE_TYPE.DONE) {
          verifiedResellers.push(reseller);
        }
      }
      
      console.log('Verified resellers found:', verifiedResellers.length);
      return verifiedResellers;
    } catch (error) {
      console.error('Error getting verified resellers:', error);
      throw new BadRequestException('Failed to fetch verified resellers');
    }
  }

  @Get('/clients')
  @Public()
  async getClients() {
    return this.userService.findUsersByRoles([RoleCode.CLIENT]);
  }

  @Get('/admins')
  async getAdmins() {
    return this.userService.findUsersByRoles([RoleCode.ADMIN]);
  }

  @Get('/all')
  @Public()
  async getAllUsers() {
    return this.userService.findUser();
  }

  @Get('/:id')
  @Public()
  async getUserById(@Param('id') id: string) {
    const user = await this.userService.findUserById(id);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return {
      success: true,
      user: user,
      data: user
    };
  }

  @Put('active/:userId')
  @UseGuards(AdminGuard)
  async setActive(
    @Param('userId') userId: string,
    @Body('isActive') isActive: any
  ) {
    if (typeof isActive !== 'boolean') {
      throw new BadRequestException('isActive must be provided and must be a boolean');
    }
    return this.userService.setUserActive(userId, isActive);
  }

  @Put('ban/:userId')
  @UseGuards(AdminGuard)
  async setBanned(
    @Param('userId') userId: string,
    @Body('isBanned') isBanned: any
  ) {
    if (typeof isBanned !== 'boolean') {
      throw new BadRequestException('isBanned must be provided and must be a boolean');
    }
    return this.userService.setUserBanned(userId, isBanned);
  }

  @Put('promote-to-reseller/:userId')
  @UseGuards(AdminGuard)
  async promoteToReseller(
    @Param('userId') userId: string
  ) {
    // Find the user first
    const user = await this.userService.findUserById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (user.type !== RoleCode.CLIENT) {
      throw new BadRequestException('User is not a client');
    }
    // Promote to reseller
    const updatedUser = await this.userService.updateUserFields(userId, { type: RoleCode.RESELLER });
    
    // Return fresh user data
    const freshUser = await this.userService.findUserById(userId);
    
    return {
      success: true,
      message: 'User promoted to reseller successfully',
      user: freshUser,
      data: freshUser
    };
  }

  @Post('update-with-identity')
  @UseGuards(AuthGuard)
  async updateUserWithIdentity(@Request() req: ProtectedRequest) {
    console.log('🆔 === UPDATE USER WITH IDENTITY ENDPOINT CALLED ===');
    console.log('🆔 Request headers:', req.headers);
    console.log('🆔 Session:', req.session);
    
    const user = req.session.user;
    console.log('updateUserWithIdentity called with user:', user);
    console.log('User type:', user.type);
    
    try {
      // Get the user's identity record
      const identity = await this.identityService.getIdentityByUser(user._id.toString());
      
      if (!identity) {
        throw new BadRequestException('No identity record found for this user');
      }
      
      console.log('🆔 Found identity record:', identity._id);
      
      // Update user to mark that they have identity (no type change)
      const updatedUser = await this.userService.updateUserFields(user._id.toString(), {
        isHasIdentity: true,
        identity: identity._id
      });
      
      console.log('🆔 User updated successfully:', updatedUser._id);
      
      // Return fresh user data
      const freshUser = await this.userService.findUserById(user._id.toString());
      
      return {
        success: true,
        message: 'User updated successfully with identity information',
        user: freshUser,
        data: freshUser,
        identityId: identity._id
      };
      
    } catch (error) {
      console.error('Error updating user with identity:', error);
      throw new BadRequestException(`Failed to update user with identity: ${error.message}`);
    }
  }

  /**
   * Deletes a user by ID. Only accessible by admins.
   * @param userId The ID of the user to delete.
   * @returns A success message.
   */
  @Delete(':userId')
  @UseGuards(AdminGuard) // Ensure only admins can delete
  async deleteUser(@Param('userId') userId: string) {
    return this.userService.deleteUser(userId);
  }

@Put('recommend/:userId')
@UseGuards(AdminGuard)
async recommendUser(
  @Param('userId') userId: string,
  @Body('isRecommended') isRecommended: boolean
) {
  if (typeof isRecommended !== 'boolean') {
    throw new BadRequestException('isRecommended must be provided and must be a boolean');
  }
  return this.userService.setUserRecommended(userId, isRecommended);
}

// Get recommended professionals
@Get('/professionals/recommended')
@Public()
async getRecommendedProfessionals() {
  return this.userService.getRecommendedProfessionals();
}

// Get recommended resellers
@Get('/resellers/recommended')
@Public()
async getRecommendedResellers() {
  return this.userService.getRecommendedResellers();
}}