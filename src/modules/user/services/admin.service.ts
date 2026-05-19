import { Injectable, BadRequestException, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { ConfigKeys } from 'src/configs/app.config';
import { User } from '../schema/user.schema';
import { RoleCode } from 'src/modules/apikey/entity/appType.entity';
import { GENDER } from '../schema/user.schema';
import * as bcrypt from 'bcrypt';

export interface CreateAdminDto {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  gender?: GENDER;
  type: RoleCode.ADMIN | RoleCode.SOUS_ADMIN;
}

@Injectable()
export class AdminService implements OnModuleInit {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.initializeAdminUsers();
  }

  /**
   * Public method to initialize admin users (for controller use)
   * @deprecated Use initializeAdminUsers() instead - for backward compatibility only
   */
  async seedAdminIfNone(): Promise<{ message: string }> {
    await this.initializeAdminUsers();
    return { message: 'Admin users initialized successfully' };
  }

  /**
   * Initialize admin and sous admin users from environment variables
   */
  async initializeAdminUsers() {
    try {
      this.logger.log('Checking for existing admin and sous admin users...');
      
      // Check if admin user exists
      const adminExists = await this.userModel.findOne({ type: RoleCode.ADMIN });
      if (!adminExists) {
        await this.createAdminFromConfig(RoleCode.ADMIN);
      } else {
        this.logger.log('Admin user already exists');
      }

      // Check if sous admin user exists
      const sousAdminExists = await this.userModel.findOne({ type: RoleCode.SOUS_ADMIN });
      if (!sousAdminExists) {
        await this.createAdminFromConfig(RoleCode.SOUS_ADMIN);
      } else {
        this.logger.log('Sous admin user already exists');
      }

    } catch (error) {
      this.logger.error('Error initializing admin users:', error);
    }
  }

  /**
   * Create admin or sous admin user from environment configuration
   */
  private async createAdminFromConfig(type: RoleCode.ADMIN | RoleCode.SOUS_ADMIN) {
    try {
      const prefix = type === RoleCode.ADMIN ? 'ADMIN' : 'SOUS_ADMIN';
      
      const adminData: CreateAdminDto = {
        firstName: this.configService.get(`${prefix}_FIRSTNAME`),
        lastName: this.configService.get(`${prefix}_LASTNAME`),
        email: this.configService.get(`${prefix}_EMAIL`),
        password: this.configService.get(`${prefix}_PASSWORD`),
        phone: this.configService.get(`${prefix}_PHONE`),
        gender: this.configService.get(`${prefix}_GENDER`) as GENDER || GENDER.MALE,
        type,
      };

      if (!adminData.firstName || !adminData.lastName || !adminData.email || !adminData.password || !adminData.phone) {
        this.logger.warn(`Missing ${type} configuration in environment variables`);
        return;
      }

      await this.createAdmin(adminData);
      this.logger.log(`${type} user created successfully from environment configuration`);
    } catch (error) {
      this.logger.error(`Error creating ${type} user from config:`, error);
    }
  }

  /**
   * Create a new admin or sous admin user
   */
  async createAdmin(adminData: CreateAdminDto): Promise<User> {
    // Validate admin type
    if (adminData.type !== RoleCode.ADMIN && adminData.type !== RoleCode.SOUS_ADMIN) {
      throw new BadRequestException('Invalid admin type. Must be ADMIN or SOUS_ADMIN');
    }

    // Check if email already exists
    const emailExists = await this.userModel.findOne({ email: adminData.email });
    if (emailExists) {
      throw new BadRequestException(`Email ${adminData.email} already exists`);
    }

    // Check if phone already exists
    const phoneExists = await this.userModel.findOne({ phone: adminData.phone });
    if (phoneExists) {
      throw new BadRequestException(`Phone ${adminData.phone} already exists`);
    }

    // Create admin user
    const admin = new this.userModel({
      firstName: adminData.firstName,
      lastName: adminData.lastName,
      email: adminData.email,
      password: adminData.password, // Will be hashed by the schema pre-save hook
      phone: adminData.phone,
      gender: adminData.gender || GENDER.MALE,
      type: adminData.type,
      isPhoneVerified: true, // Admin users are pre-verified
      isVerified: true,
      isActive: true,
      rate: 10, // Max rating for admin users
    });

    return await admin.save();
  }

  /**
   * Get all admin users (including sous admins)
   */
  async getAllAdmins(): Promise<User[]> {
    return this.userModel.find({
      type: { $in: [RoleCode.ADMIN, RoleCode.SOUS_ADMIN] }
    }).populate('avatar');
  }

  /**
   * Get admin users only (excluding sous admins)
   */
  async getAdminsOnly(): Promise<User[]> {
    return this.userModel.find({ type: RoleCode.ADMIN }).populate('avatar');
  }

  /**
   * Get sous admin users only
   */
  async getSousAdmins(): Promise<User[]> {
    return this.userModel.find({ type: RoleCode.SOUS_ADMIN }).populate('avatar');
  }

  /**
   * Update admin user
   */
  async updateAdmin(adminId: string, updateData: Partial<CreateAdminDto>): Promise<User> {
    const admin = await this.userModel.findById(adminId);
    if (!admin) {
      throw new BadRequestException('Admin user not found');
    }

    if (admin.type !== RoleCode.ADMIN && admin.type !== RoleCode.SOUS_ADMIN) {
      throw new BadRequestException('User is not an admin');
    }

    // If password is being updated, hash it
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    // Prevent changing admin type to non-admin roles
    if (updateData.type && updateData.type !== RoleCode.ADMIN && updateData.type !== RoleCode.SOUS_ADMIN) {
      throw new BadRequestException('Cannot change admin type to non-admin role');
    }

    return this.userModel.findByIdAndUpdate(adminId, updateData, { new: true }).populate('avatar');
  }

  /**
   * Delete admin user (with restrictions)
   */
  async deleteAdmin(adminId: string, currentUserId: string): Promise<{ message: string }> {
    const admin = await this.userModel.findById(adminId);
    if (!admin) {
      throw new BadRequestException('Admin user not found');
    }

    if (admin.type !== RoleCode.ADMIN && admin.type !== RoleCode.SOUS_ADMIN) {
      throw new BadRequestException('User is not an admin');
    }

    // Prevent self-deletion
    if (adminId === currentUserId) {
      throw new BadRequestException('Cannot delete your own admin account');
    }

    // Prevent deletion of the last admin user
    const adminCount = await this.userModel.countDocuments({ type: RoleCode.ADMIN });
    if (admin.type === RoleCode.ADMIN && adminCount <= 1) {
      throw new BadRequestException('Cannot delete the last admin user');
    }

    await this.userModel.findByIdAndDelete(adminId);
    return { message: `${admin.type} user deleted successfully` };
  }

  /**
   * Change admin password
   */
  async changeAdminPassword(adminId: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const admin = await this.userModel.findById(adminId).select('+password');
    if (!admin) {
      throw new BadRequestException('Admin user not found');
    }

    if (admin.type !== RoleCode.ADMIN && admin.type !== RoleCode.SOUS_ADMIN) {
      throw new BadRequestException('User is not an admin');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, admin.password);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Update password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await this.userModel.findByIdAndUpdate(adminId, { password: hashedNewPassword });

    return { message: 'Admin password changed successfully' };
  }

  /**
   * Check if user has admin privileges (admin or sous admin)
   */
  hasAdminPrivileges(userType: RoleCode): boolean {
    return userType === RoleCode.ADMIN || userType === RoleCode.SOUS_ADMIN;
  }

  /**
   * Check if user is full admin (not sous admin)
   */
  isFullAdmin(userType: RoleCode): boolean {
    return userType === RoleCode.ADMIN;
  }

  /**
   * Check if user is sous admin
   */
  isSousAdmin(userType: RoleCode): boolean {
    return userType === RoleCode.SOUS_ADMIN;
  }
}