import { BadRequestException, Injectable, OnModuleInit, Logger } from '@nestjs/common';
// import { CLIENT_TYPE, CreateUserDto } from '../auth/dto/createUser.dto';
import { RoleCode } from '../apikey/entity/appType.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model, RootFilterQuery, Types } from 'mongoose';
import { User, UserDocument } from './schema/user.schema';
import { ConfigService } from '@nestjs/config';
import { ConfigKeys } from 'src/configs/app.config';
import * as bcrypt from 'bcrypt';
import { Professional } from './schema/pro.schema';
import { AttachmentService } from '../attachment/attachment.service';
import { Category } from '../category/schema/category.schema';
import { getApiBaseUrl } from 'src/common/utils';

@Injectable()
export class UserService implements OnModuleInit {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Category.name) private readonly categoryModel: Model<Category>,
    private readonly configService: ConfigService,
    private readonly attachmentService: AttachmentService,
  ) { }


  async findUser(user?: RootFilterQuery<User>) {
    const users = await this.userModel.find(user).populate(['avatar', 'coverPhoto', 'identity']);
    // Convert secteur IDs to names for all users
    for (const user of users) {
      await this.convertSecteurIdToName(user);
    }
    return users;
  }

  // Helper method to enrich user with avatar URLs
  private enrichUserWithAvatarUrls(user: UserDocument | any): any {
    // Get subscriptionPlan BEFORE converting to object - try multiple ways to access it
    let subscriptionPlan: string | null = null;

    // Try direct access
    if (user.subscriptionPlan) {
      subscriptionPlan = user.subscriptionPlan;
    }
    // Try as any
    else if ((user as any)?.subscriptionPlan) {
      subscriptionPlan = (user as any).subscriptionPlan;
    }
    // Try using get() method
    else if (user.get && typeof user.get === 'function') {
      try {
        subscriptionPlan = user.get('subscriptionPlan') || null;
      } catch (e) {
        // Ignore errors
      }
    }
    // Try accessing from document
    else if ((user as any)?._doc?.subscriptionPlan) {
      subscriptionPlan = (user as any)._doc.subscriptionPlan;
    }
    const userObj = user.toObject ? user.toObject({ virtuals: true, getters: true }) : { ...user };

    // ALWAYS explicitly set subscriptionPlan field - even if null, so it appears in JSON response
    userObj.subscriptionPlan = subscriptionPlan || null;
    // Use API_BASE_URL if available, otherwise construct from APP_HOST/APP_PORT
    const apiBaseUrl = getApiBaseUrl();

    const fullBaseUrl = apiBaseUrl.replace(/\/$/, '');

    // Ensure avatar has fullUrl and photoURL if it exists
    if (userObj.avatar && typeof userObj.avatar === 'object' && !Array.isArray(userObj.avatar)) {
      const avatarUrl = (userObj.avatar as any).url || `/static/${(userObj.avatar as any).filename}`;
      userObj.avatar.fullUrl = `${fullBaseUrl}${avatarUrl}`;
      userObj.photoURL = userObj.avatar.fullUrl;
    } else if (!userObj.photoURL) {
      // Set photoURL from virtual if avatar exists but photoURL is missing
      if (user.avatar && typeof user.avatar === 'object' && !Array.isArray(user.avatar)) {
        const avatarUrl = (user.avatar as any).url || `/static/${(user.avatar as any).filename}`;
        userObj.photoURL = `${fullBaseUrl}${avatarUrl}`;
      } else {
        userObj.photoURL = null;
      }
    }

    return userObj;
  }

  async findUserById(id: string) {
    if (!id || !Types.ObjectId.isValid(id)) {
      return null;
    }
    const user = await this.userModel.findById(id).populate(['avatar', 'coverPhoto', 'identity']);
    if (user) {
      // Convert secteur ID to name if needed
      await this.convertSecteurIdToName(user);

      // Enrich user with avatar URLs
      const enrichedUser = this.enrichUserWithAvatarUrls(user);
      // Ensure subscriptionPlan is explicitly included
      if (user.subscriptionPlan) {
        enrichedUser.subscriptionPlan = user.subscriptionPlan;
      }
      return enrichedUser;
    }
    return null;
  }

  // NEW: Find users by filter (Broadcast)
  async findUsersByFilter(filterType: 'ALL' | 'SECTEUR' | 'WILAYA' | 'USERS', filterValue?: string[]) {
    const query: any = {};

    // Base query: only target actual users (not admins/guests usually) unless specific IDs provided
    // If filtering by specific USERS, we trust the IDs provided.
    // Otherwise, we target CLIENT, PROFESSIONAL, RESELLER.
    if (filterType !== 'USERS') {
      query.type = { $in: [RoleCode.CLIENT, RoleCode.PROFESSIONAL, RoleCode.RESELLER] };
    }

    if (filterType === 'SECTEUR' && filterValue && filterValue.length > 0) {
      query.secteur = { $in: filterValue };
    } else if (filterType === 'WILAYA' && filterValue && filterValue.length > 0) {
      query.wilaya = { $in: filterValue };
    } else if (filterType === 'USERS' && filterValue && filterValue.length > 0) {
      query._id = { $in: filterValue };
    }
    const users = await this.userModel.find(query).populate(['avatar', 'coverPhoto']);
    // Enrich users
    const enrichedUsers = [];
    for (const user of users) {
      await this.convertSecteurIdToName(user);
      const enrichedUser = this.enrichUserWithAvatarUrls(user);
      // Ensure subscriptionPlan is explicitly included
      if (user.subscriptionPlan) {
        enrichedUser.subscriptionPlan = user.subscriptionPlan;
      }
      enrichedUsers.push(enrichedUser);
    }
    return enrichedUsers;
  }

  // NEW: Find users by array of IDs
  async findUsersByIds(ids: string[]) {
    const users = await this.userModel.find({ _id: { $in: ids } }).populate(['avatar', 'coverPhoto']);
    // Convert secteur IDs to names and enrich with avatar URLs for all users
    const enrichedUsers = [];
    for (const user of users) {
      await this.convertSecteurIdToName(user);
      const enrichedUser = this.enrichUserWithAvatarUrls(user);
      // Ensure subscriptionPlan is explicitly included
      if (user.subscriptionPlan) {
        enrichedUser.subscriptionPlan = user.subscriptionPlan;
      }
      enrichedUsers.push(enrichedUser);
    }
    return enrichedUsers;
  }

  async findByLogin(login: string) {
    // Input validation
    if (!login || typeof login !== 'string') {
      console.error('findByLogin: Invalid login parameter:', login);
      return null;
    }

    try {
      // Escape special regex characters to prevent crashes
      const escapedLogin = login.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const user = await this.userModel.findOne({
        $or: [
          { email: { $regex: new RegExp(`^${escapedLogin}$`, 'i') } },
          { phone: login }
        ],
      }).populate(['avatar', 'coverPhoto']);
      return user;
    } catch (error) {
      console.error('🔍 findByLogin: Database error:', {
        message: (error as Error).message,
        login: login
      });
      throw error;
    }
  }

  async validatePhone(userID: Types.ObjectId) {
    const user = await this.userModel.findByIdAndUpdate(
      userID,
      {
        isPhoneVerified: true,
        rate: 1, // Set default rate for unverified users
      },
      { new: true },
    ).populate(['avatar', 'coverPhoto']);

    return user;
  }

  async verifyEmailPhoneNumber(data: { email?: string; phone?: string }) {
    if (data.email) {
      const emailExist = await this.userModel.findOne({ email: data.email });
      if (emailExist) throw new BadRequestException('Email already exist'); // FIXME: TRANSLATE THIS
    }

    if (data.phone) {
      const phoneExist = await this.userModel.findOne({ phone: data.phone });
      if (phoneExist)
        throw new BadRequestException('Phone number already exist'); // FIXME: TRANSLATE THIS
    }
  }

  async onModuleInit() {
    // Admin user initialization is now handled by AdminService
    this.logger.log('UserService initialized - admin creation delegated to AdminService');

    // Automatically correct discriminator keys (__t) in the database on startup (for legacy data)
    try {
      this.logger.log('Running automatic discriminator (__t) key alignment...');
      const usersCollection = this.userModel.collection;

      // Fix Professionals
      const proResult = await usersCollection.updateMany(
        { type: RoleCode.PROFESSIONAL, __t: { $ne: 'Professional' } },
        { $set: { __t: 'Professional' } }
      );
      if (proResult.modifiedCount > 0) {
        this.logger.log(`Aligned ${proResult.modifiedCount} professional discriminator keys to 'Professional'`);
      }

      // Fix Resellers
      const resellerResult = await usersCollection.updateMany(
        { type: RoleCode.RESELLER, __t: { $ne: 'Reseller' } },
        { $set: { __t: 'Reseller' } }
      );
      if (resellerResult.modifiedCount > 0) {
        this.logger.log(`Aligned ${resellerResult.modifiedCount} reseller discriminator keys to 'Reseller'`);
      }

      // Fix Clients
      const clientResult = await usersCollection.updateMany(
        { type: RoleCode.CLIENT, __t: { $ne: 'Buyer' } },
        { $set: { __t: 'Buyer' } }
      );
      if (clientResult.modifiedCount > 0) {
        this.logger.log(`Aligned ${clientResult.modifiedCount} client discriminator keys to 'Buyer'`);
      }

      // Fix Admins
      const adminResult = await usersCollection.updateMany(
        { type: { $in: [RoleCode.ADMIN, RoleCode.SOUS_ADMIN] }, __t: { $ne: 'Admin' } },
        { $set: { __t: 'Admin' } }
      );
      if (adminResult.modifiedCount > 0) {
        this.logger.log(`Aligned ${adminResult.modifiedCount} admin discriminator keys to 'Admin'`);
      }
    } catch (error) {
      this.logger.error('Error aligning discriminator keys on startup:', error);
    }
  }

  async findAllBuyers() {
    const users = await this.userModel.find({ role: RoleCode.CLIENT }).populate(['avatar', 'coverPhoto']);
    // Convert secteur IDs to names and enrich with avatar URLs for all users
    const enrichedUsers = [];
    for (const user of users) {
      await this.convertSecteurIdToName(user);
      enrichedUsers.push(this.enrichUserWithAvatarUrls(user));
    }
    return enrichedUsers;
  }

  async updatePassword(userId: Types.ObjectId, newPassword: string) {
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.userModel.findByIdAndUpdate(userId, { password: hashed });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    // Find user with password field included
    const user = await this.userModel.findById(userId).select('+password');

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password and update
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await this.userModel.findByIdAndUpdate(userId, { password: hashedNewPassword });

    return { message: 'Password changed successfully' };
  }

  async updateUserFields(userId: string, update: Partial<User>) {
    try {
      if (update.type) {
        let expectedT = null;
        if (update.type === RoleCode.PROFESSIONAL) {
          expectedT = 'Professional';
        } else if (update.type === RoleCode.RESELLER) {
          expectedT = 'Reseller';
        } else if (update.type === RoleCode.CLIENT) {
          expectedT = 'Buyer';
        } else if (update.type === RoleCode.ADMIN || update.type === RoleCode.SOUS_ADMIN) {
          expectedT = 'Admin';
        }
        if (expectedT) {
          await this.userModel.collection.updateOne(
            { _id: new Types.ObjectId(userId) },
            { $set: { __t: expectedT } }
          );
        }
      }
      const updatedUser = await this.userModel.findByIdAndUpdate(userId, update, { new: true }).populate(['avatar', 'coverPhoto', 'identity']);
      return updatedUser;
    } catch (error) {
      console.error('Error updating user fields:', error);
      throw error;
    }
  }

  async updateUserRate(userId: string, newRate: number) {
    // Ensure rate is within valid range (1-10)
    const clampedRate = Math.max(1, Math.min(10, newRate));
    return this.userModel.findByIdAndUpdate(userId, { rate: clampedRate }, { new: true }).populate(['avatar', 'coverPhoto']);
  }

  async updateSubscriptionPlan(userId: string, plan: string) {
    const result = await this.userModel.findByIdAndUpdate(
      userId,
      { subscriptionPlan: plan },
      { new: true, runValidators: true }
    ).populate(['avatar', 'coverPhoto']);
    return result;
  }

  async createSubscriptionPlan(userId: string, plan: string) {
    const user = await this.userModel.findById(userId).populate(['avatar', 'coverPhoto']);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (user.subscriptionPlan) {
      throw new BadRequestException('Subscription plan already exists for this user');
    }
    user.subscriptionPlan = plan;
    await user.save();
    return user;
  }

  async setUserVerified(userId: string, isVerified: boolean) {
    const updateFields: Partial<User> = { isVerified };
    // If user is being verified, set rate to 3
    if (isVerified) {
      updateFields.rate = 3;
    }
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true }
    ).populate(['avatar', 'coverPhoto']);
    if (!user) throw new BadRequestException('User not found');
    return user;
  }

  async findUsersByRoles(roles: RoleCode[]) {
    // Query users - subscriptionPlan should be included by default
    const users = await this.userModel.find({ type: { $in: roles } })
      .populate(['avatar', 'coverPhoto', 'identity'])
      .lean(false); // Don't use lean() to preserve document methods and virtuals
    // Convert secteur IDs to names and enrich with avatar URLs for all users
    const enrichedUsers = [];
    for (const user of users) {
      await this.convertSecteurIdToName(user);

      // Get subscriptionPlan from the document - try multiple access methods
      let planFromDoc: string | null | undefined = undefined;

      // Try direct access first
      if ((user as any).subscriptionPlan !== undefined) {
        planFromDoc = (user as any).subscriptionPlan;
      }
      // Try _doc access
      else if ((user as any)._doc?.subscriptionPlan !== undefined) {
        planFromDoc = (user as any)._doc.subscriptionPlan;
      }
      // Try get() method
      else if ((user as any).get && typeof (user as any).get === 'function') {
        try {
          planFromDoc = (user as any).get('subscriptionPlan');
        } catch (e) {
          // Ignore
        }
      }

      // Convert undefined to null for consistency
      if (planFromDoc === undefined) {
        planFromDoc = null;
      }
      const enrichedUser = this.enrichUserWithAvatarUrls(user);

      // CRITICAL: Always explicitly set subscriptionPlan field - even if null
      // This ensures it appears in the JSON response
      enrichedUser.subscriptionPlan = enrichedUser.subscriptionPlan ?? planFromDoc ?? null;

      // Double-check: ensure the field exists in the object
      if (!('subscriptionPlan' in enrichedUser)) {
        enrichedUser.subscriptionPlan = null;
      }
      enrichedUsers.push(enrichedUser);
    }
    return enrichedUsers;
  }

  async setUserActive(userId: string, isActive: boolean) {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { isActive },
      { new: true }
    ).populate(['avatar', 'coverPhoto']);
    if (!user) throw new BadRequestException('User not found');
    return user;
  }

  async setUserBanned(userId: string, isBanned: boolean) {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { isBanned },
      { new: true }
    ).populate(['avatar', 'coverPhoto']); // Ensure avatar is populated
    if (!user) throw new BadRequestException('User not found');
    return user;
  }

  async setUserCertified(userId: string, isCertified: boolean) {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { isCertified },
      { new: true }
    ).populate(['avatar', 'coverPhoto']);
    if (!user) throw new BadRequestException('User not found');
    return user;
  }

  async getUserById(id: string) {
    if (!id || !Types.ObjectId.isValid(id)) {
      return null;
    }
    const user = await this.userModel.findById(id).populate(['avatar', 'coverPhoto']);
    if (user && user.avatar && typeof user.avatar === 'object' && !Array.isArray(user.avatar)) {
      // Ensure avatar has fullUrl
      const userWithFullUrl = user.toObject() as any;

      // Use API_BASE_URL if available, otherwise construct from APP_HOST/APP_PORT
      const apiBaseUrl = getApiBaseUrl();

      const fullBaseUrl = apiBaseUrl.replace(/\/$/, '');
      const avatarUrl = (user.avatar as any).url || `/static/${(user.avatar as any).filename}`;
      userWithFullUrl.avatar.fullUrl = `${fullBaseUrl}${avatarUrl}`;

      // Also set photoURL for backward compatibility
      userWithFullUrl.photoURL = userWithFullUrl.avatar.fullUrl;

      return userWithFullUrl;
    }
    return user;
  }

  async findOne(id: string) {
    return this.getUserById(id);
  }

  async findUserByIdWithAvatar(userId: string) {
    const user = await this.userModel.findById(userId).populate(['avatar', 'coverPhoto']).exec();
    if (user && user.avatar) {
      // Construct the full URL for the avatar using the same logic as AttachmentService
      const userWithFullUrl = user.toObject() as any;

      // Use API_BASE_URL if available, otherwise construct from APP_HOST/APP_PORT
      const apiBaseUrl = getApiBaseUrl();

      const fullBaseUrl = apiBaseUrl.replace(/\/$/, '');
      userWithFullUrl.avatar.fullUrl = `${fullBaseUrl}${user.avatar.url}`;
      return userWithFullUrl;
    }
    return user;
  }

  /**
   * Deletes a user by their ID.
   * @param userId The ID of the user to delete.
   * @returns An object indicating success and the deleted user, or throws BadRequestException if not found.
   */
  async deleteUser(userId: string): Promise<{ message: string; user: User | null }> {
    const user = await this.userModel.findByIdAndDelete(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return { message: 'User deleted successfully', user };
  }

  async setUserRecommended(userId: string, isRecommended: boolean) {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { isRecommended },
      { new: true }
    ).populate(['avatar', 'coverPhoto']);
    if (!user) throw new BadRequestException('User not found');
    return user;
  }

  async getRecommendedProfessionals() {
    const users = await this.userModel.find({
      type: RoleCode.PROFESSIONAL,
      isRecommended: true,
      isVerified: true,
      isActive: true,
      isBanned: false
    }).populate(['avatar', 'coverPhoto']);
    // Convert secteur IDs to names and enrich with avatar URLs for all users
    const enrichedUsers = [];
    for (const user of users) {
      await this.convertSecteurIdToName(user);
      const enrichedUser = this.enrichUserWithAvatarUrls(user);
      // Ensure subscriptionPlan is explicitly included
      if (user.subscriptionPlan) {
        enrichedUser.subscriptionPlan = user.subscriptionPlan;
      }
      enrichedUsers.push(enrichedUser);
    }
    return enrichedUsers;
  }

  async getRecommendedResellers() {
    const users = await this.userModel.find({
      type: RoleCode.RESELLER,
      isRecommended: true,
      isVerified: true,
      isActive: true,
      isBanned: false
    }).populate(['avatar', 'coverPhoto']);
    // Convert secteur IDs to names and enrich with avatar URLs for all users
    const enrichedUsers = [];
    for (const user of users) {
      await this.convertSecteurIdToName(user);
      enrichedUsers.push(this.enrichUserWithAvatarUrls(user));
    }
    return enrichedUsers;
  }

  /**
   * Converts secteur field from category ID to category name if needed
   * @param user User document to process
   */
  private async convertSecteurIdToName(user: UserDocument | any): Promise<void> {
    if (!user.secteur || user.type !== RoleCode.PROFESSIONAL) {
      return;
    }

    // Check if secteur is a valid hex string of length 24
    const isHex = /^[0-9a-fA-F]{24}$/.test(user.secteur);
    if (isHex && Types.ObjectId.isValid(user.secteur)) {
      try {
        const category = await this.categoryModel.findById(user.secteur);
        if (category) {
          // Update the user in the database with the category name
          await this.userModel.updateOne(
            { _id: user._id },
            { $set: { secteur: category.name } }
          );
          // Update the current user object
          user.secteur = category.name;
          this.logger.log(`Converted secteur ID ${user.secteur} to name "${category.name}" for user ${user.firstName} ${user.lastName}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to convert secteur ID ${user.secteur} for user ${user.firstName} ${user.lastName}: ${error.message}`);
      }
    }
  }

  async updateUserType(userId: string, newType: RoleCode): Promise<User> {
    let expectedT = null;
    if (newType === RoleCode.PROFESSIONAL) {
      expectedT = 'Professional';
    } else if (newType === RoleCode.RESELLER) {
      expectedT = 'Reseller';
    } else if (newType === RoleCode.CLIENT) {
      expectedT = 'Buyer';
    } else if (newType === RoleCode.ADMIN || newType === RoleCode.SOUS_ADMIN) {
      expectedT = 'Admin';
    }
    if (expectedT) {
      await this.userModel.collection.updateOne(
        { _id: new Types.ObjectId(userId) },
        { $set: { __t: expectedT } }
      );
    }

    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { type: newType },
      { new: true }
    ).populate(['avatar', 'coverPhoto', 'identity']);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return user;
  }

  async incrementLoginCount(userId: string) {
    return this.userModel.findByIdAndUpdate(userId, { $inc: { loginCount: 1 } });
  }
}