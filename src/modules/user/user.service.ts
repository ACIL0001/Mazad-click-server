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

@Injectable()
export class UserService implements OnModuleInit {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
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
    return this.userModel.find(user).populate('avatar');
  }

  async findUserById(id: string) {
    return this.userModel.findById(id).populate('avatar');
  }

  // NEW: Find users by array of IDs
  async findUsersByIds(ids: string[]) {
    return this.userModel.find({ _id: { $in: ids } }).populate('avatar');
  }

  async findByLogin(login: string) {
    const user = await this.userModel.findOne({
      $or: [{ email: login }, { phone: login }],
    }).populate('avatar');
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
    return this.userModel.find({ role: RoleCode.CLIENT }).populate('avatar');
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
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { isVerified },
      { new: true }
    ).populate('avatar');
    if (!user) throw new BadRequestException('User not found');
    return user;
  }

  async findUsersByRoles(roles: RoleCode[]) {
    return this.userModel.find({ type: { $in: roles } }).populate('avatar');
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
    return user;
  }

  async findUserByIdWithAvatar(userId: string) {
    const user = await this.userModel.findById(userId).populate('avatar').exec();
    if (user && user.avatar) {
      // This method already correctly populates and constructs the full URL.
      const userWithFullUrl = user.toObject() as any;
      const baseUrl = process.env.APP_HOST || 'http://localhost';
      const appPort = process.env.APP_PORT || 3000;
      const hostPart = appPort ? baseUrl.replace(/\/$/, '') : baseUrl;
      const fullBaseUrl = appPort ? `${hostPart}:${appPort}` : hostPart;
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
  return this.userModel.find({ 
    type: RoleCode.PROFESSIONAL, 
    isRecommended: true,
    isVerified: true,
    isActive: true,
    isBanned: false
  }).populate('avatar');
}

async getRecommendedResellers() {
  return this.userModel.find({ 
    type: RoleCode.RESELLER, 
    isRecommended: true,
    isVerified: true,
    isActive: true,
    isBanned: false
  }).populate('avatar');
}}