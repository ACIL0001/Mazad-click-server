import { BadRequestException, Injectable, OnModuleInit, Logger } from '@nestjs/common';
// import { CLIENT_TYPE, CreateUserDto } from '../auth/dto/createUser.dto';
import { RoleCode } from '../apikey/entity/appType.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model, RootFilterQuery, Types } from 'mongoose';
import { User } from './schema/user.schema';
import { ConfigService } from '@nestjs/config';
import { ConfigKeys } from 'src/configs/app.config';
import * as bcrypt from 'bcrypt';
import { Professional } from './schema/pro.schema';
import { AttachmentService } from '../attachment/attachment.service';
import { Category } from '../category/schema/category.schema';

@Injectable()
export class UserService implements OnModuleInit {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Category.name) private readonly categoryModel: Model<Category>,
    private readonly configService: ConfigService,
    private readonly attachmentService: AttachmentService,
  ) {}

  // async create(userData: CreateUserDto) {
  //   const emailExist = await this.userModel.findOne({
  //     email: userData.email,
  //   });

  //   if (emailExist) throw new BadRequestException('Email already exist'); // FIXME: TRANSLATE THIS

  //   const phoneExist = await this.userModel.findOne({
  //     phone: userData.phone,
  //   });
  //   if (phoneExist) throw new BadRequestException('Phone number already exist'); // FIXME: TRANSLATE THIS

  //   const user = await this.userModel.create({
  //     ...userData,
  //   });

  //   return user;
  // }

  async findUser(user?: RootFilterQuery<User>) {
    const users = await this.userModel.find(user).populate('avatar');
    // Convert secteur IDs to names for all users
    for (const user of users) {
      await this.convertSecteurIdToName(user);
    }
    return users;
  }

  // Helper method to enrich user with avatar URLs
  private enrichUserWithAvatarUrls(user: any): any {
    const userObj = user.toObject ? user.toObject({ virtuals: true }) : user;
    
    // Use API_BASE_URL if available, otherwise construct from APP_HOST/APP_PORT
    const apiBaseUrl = process.env.API_BASE_URL ||
                      (() => {
                        const appHost = process.env.APP_HOST || 'http://localhost';
                        const appPort = process.env.APP_PORT || 3000;
                        const isProduction = process.env.NODE_ENV === 'production';
                        
                        // In production, use https://api.mazad.click if APP_HOST is not explicitly set
                        if (isProduction && (appHost.includes('localhost') || !appHost.startsWith('https'))) {
                          return 'https://api.mazad.click';
                        }
                        
                        // Parse the host to check if it already has a port
                        let hostPart = appHost.replace(/\/$/, '');
                        
                        // Check if hostname (after ://) already has a port number
                        // Example: http://localhost:3000 -> has port
                        // Example: http://localhost -> needs port
                        const hostnameMatch = hostPart.match(/:\/\/([^\/]+)/);
                        if (hostnameMatch) {
                          const hostname = hostnameMatch[1];
                          // If hostname doesn't contain a colon (which would indicate a port), add it
                          if (!hostname.includes(':') && appPort) {
                            hostPart = hostPart.replace(/:\/\/[^\/]+/, `://${hostname}:${appPort}`);
                          }
                        } else if (appPort) {
                          // If no protocol, just append port
                          hostPart = `${hostPart}:${appPort}`;
                        }
                        
                        return hostPart;
                      })();
    
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
    const user = await this.userModel.findById(id).populate('avatar');
    if (user) {
      // Convert secteur ID to name if needed
      await this.convertSecteurIdToName(user);
      
      // Enrich user with avatar URLs
      return this.enrichUserWithAvatarUrls(user);
    }
    return null;
  }

  // NEW: Find users by array of IDs
  async findUsersByIds(ids: string[]) {
    const users = await this.userModel.find({ _id: { $in: ids } }).populate('avatar');
    // Convert secteur IDs to names and enrich with avatar URLs for all users
    const enrichedUsers = [];
    for (const user of users) {
      await this.convertSecteurIdToName(user);
      enrichedUsers.push(this.enrichUserWithAvatarUrls(user));
    }
    return enrichedUsers;
  }

  async findByLogin(login: string) {
    // ▼▼▼ CORRECTION HERE ▼▼▼
    // Use a case-insensitive regex for the email field.
    // Anchor the regex with ^ (start) and $ (end) to match the *entire* string.
    const user = await this.userModel.findOne({
      $or: [
        { email: { $regex: new RegExp(`^${login}$`, 'i') } }, 
        { phone: login }
      ],
    }).populate('avatar');
    // ▲▲▲ CORRECTION ENDS ▲▲▲
    
    // if (!user) throw new BadRequestException('Invalid login'); // FIXME: TRANSLATE THIS
    return user;
  }

  async validatePhone(userID: Types.ObjectId) {
    const user = await this.userModel.findByIdAndUpdate(
      userID,
      {
        isPhoneVerified: true,
      },
      { new: true },
    ).populate('avatar');

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
  }

  async findAllBuyers() {
    const users = await this.userModel.find({ role: RoleCode.CLIENT }).populate('avatar');
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
      const updatedUser = await this.userModel.findByIdAndUpdate(userId, update, { new: true }).populate('avatar');
      return updatedUser;
    } catch (error) {
      console.error('Error updating user fields:', error);
      throw error;
    }
  }

  async updateUserRate(userId: string, newRate: number) {
    // Ensure rate is within valid range (1-10)
    const clampedRate = Math.max(1, Math.min(10, newRate));
    return this.userModel.findByIdAndUpdate(userId, { rate: clampedRate }, { new: true }).populate('avatar');
  }

  async updateSubscriptionPlan(userId: string, plan: string) {
    const result = await this.userModel.findByIdAndUpdate(userId, { subscriptionPlan: plan }, { new: true }).populate('avatar');
    return result;
  }

  async createSubscriptionPlan(userId: string, plan: string) {
    const user = await this.userModel.findById(userId).populate('avatar');
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
    const updateFields: any = { isVerified };
    // If user is being verified, set rate to 3
    if (isVerified) {
      updateFields.rate = 3;
    }
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true }
    ).populate('avatar');
    if (!user) throw new BadRequestException('User not found');
    return user;
  }

  async findUsersByRoles(roles: RoleCode[]) {
    const users = await this.userModel.find({ type: { $in: roles } }).populate('avatar');
    // Convert secteur IDs to names and enrich with avatar URLs for all users
    const enrichedUsers = [];
    for (const user of users) {
      await this.convertSecteurIdToName(user);
      enrichedUsers.push(this.enrichUserWithAvatarUrls(user));
    }
    return enrichedUsers;
  }

  async setUserActive(userId: string, isActive: boolean) {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { isActive },
      { new: true }
    ).populate('avatar');
    if (!user) throw new BadRequestException('User not found');
    return user;
  }

  async setUserBanned(userId: string, isBanned: boolean) {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { isBanned },
      { new: true }
    ).populate('avatar'); // Ensure avatar is populated
    if (!user) throw new BadRequestException('User not found');
    return user;
  }

  async getUserById(id: string) {
    const user = await this.userModel.findById(id).populate('avatar');
    if (user && user.avatar && typeof user.avatar === 'object' && !Array.isArray(user.avatar)) {
      // Ensure avatar has fullUrl
      const userWithFullUrl = user.toObject() as any;
      
      // Use API_BASE_URL if available, otherwise construct from APP_HOST/APP_PORT
      const apiBaseUrl = process.env.API_BASE_URL ||
                        (() => {
                          const appHost = process.env.APP_HOST || 'http://localhost';
                          const appPort = process.env.APP_PORT || 3000;
                          const isProduction = process.env.NODE_ENV === 'production';
                          
                          // In production, use https://api.mazad.click if APP_HOST is not explicitly set
                          if (isProduction && (appHost.includes('localhost') || !appHost.startsWith('https'))) {
                            return 'https://api.mazad.click';
                          }
                          
                          const hostPart = appPort && !appHost.includes(':') ? appHost.replace(/\/$/, '') : appHost.replace(/\/$/, '');
                          return appPort && !hostPart.includes(':') ? `${hostPart}:${appPort}` : hostPart;
                        })();
      
      const fullBaseUrl = apiBaseUrl.replace(/\/$/, '');
      const avatarUrl = (user.avatar as any).url || `/static/${(user.avatar as any).filename}`;
      userWithFullUrl.avatar.fullUrl = `${fullBaseUrl}${avatarUrl}`;
      
      // Also set photoURL for backward compatibility
      userWithFullUrl.photoURL = userWithFullUrl.avatar.fullUrl;
      
      return userWithFullUrl;
    }
    return user;
  }

  async findUserByIdWithAvatar(userId: string) {
    const user = await this.userModel.findById(userId).populate('avatar').exec();
    if (user && user.avatar) {
      // Construct the full URL for the avatar using the same logic as AttachmentService
      const userWithFullUrl = user.toObject() as any;
      
      // Use API_BASE_URL if available, otherwise construct from APP_HOST/APP_PORT
      const apiBaseUrl = process.env.API_BASE_URL ||
                        (() => {
                          const appHost = process.env.APP_HOST || 'http://localhost';
                          const appPort = process.env.APP_PORT || 3000;
                          const isProduction = process.env.NODE_ENV === 'production';
                          
                          // In production, use https://api.mazad.click if APP_HOST is not explicitly set
                          if (isProduction && (appHost.includes('localhost') || !appHost.startsWith('https'))) {
                            return 'https://api.mazad.click';
                          }
                          
                          const hostPart = appPort && !appHost.includes(':') ? appHost.replace(/\/$/, '') : appHost.replace(/\/$/, '');
                          return appPort && !hostPart.includes(':') ? `${hostPart}:${appPort}` : hostPart;
                        })();
      
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
  ).populate('avatar');
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
  }).populate('avatar');
  // Convert secteur IDs to names and enrich with avatar URLs for all users
  const enrichedUsers = [];
  for (const user of users) {
    await this.convertSecteurIdToName(user);
    enrichedUsers.push(this.enrichUserWithAvatarUrls(user));
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
  }).populate('avatar');
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
  private async convertSecteurIdToName(user: any): Promise<void> {
    if (!user.secteur || user.type !== RoleCode.PROFESSIONAL) {
      return;
    }

    // Check if secteur is a valid ObjectId (24-character hex string)
    if (Types.ObjectId.isValid(user.secteur) && user.secteur.length === 24) {
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
  const user = await this.userModel.findByIdAndUpdate(
    userId,
    { type: newType },
    { new: true }
  ).populate('avatar');
  
  if (!user) {
    throw new BadRequestException('User not found');
  }
  
  return user;
}
}