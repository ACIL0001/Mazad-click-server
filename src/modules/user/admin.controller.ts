import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  Request,
} from '@nestjs/common';
import { AdminService, CreateAdminDto } from './services/admin.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AdminOnlyGuard } from '../../common/guards/admin-only.guard';
import { SousAdminGuard } from '../../common/guards/sous-admin.guard';
import { RoleCode } from '../apikey/entity/appType.entity';
import { ProtectedRequest } from '../../types/request.type';

@Controller('admin')
@UseGuards(AuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * Get all admins (Admin only)
   */
  @Get('all')
  @UseGuards(AdminOnlyGuard)
  async getAllAdmins() {
    return {
      success: true,
      data: await this.adminService.getAllAdmins(),
    };
  }

  /**
   * Get only admin users (Admin only)
   */
  @Get('admins-only')
  @UseGuards(AdminOnlyGuard)
  async getAdminsOnly() {
    return {
      success: true,
      data: await this.adminService.getAdminsOnly(),
    };
  }

  /**
   * Get sous admin users (Admin and Sous Admin can access)
   */
  @Get('sous-admins')
  @UseGuards(SousAdminGuard)
  async getSousAdmins() {
    return {
      success: true,
      data: await this.adminService.getSousAdmins(),
    };
  }

  /**
   * Create new admin user (Admin only)
   */
  @Post('create-admin')
  @UseGuards(AdminOnlyGuard)
  async createAdmin(@Body() adminData: CreateAdminDto) {
    if (adminData.type !== RoleCode.ADMIN) {
      throw new BadRequestException('This endpoint is for creating admin users only');
    }

    const admin = await this.adminService.createAdmin(adminData);
    return {
      success: true,
      message: 'Admin user created successfully',
      data: admin,
    };
  }

  /**
   * Create new sous admin user (Admin only)
   */
  @Post('create-sous-admin')
  @UseGuards(AdminOnlyGuard)
  async createSousAdmin(@Body() adminData: CreateAdminDto) {
    adminData.type = RoleCode.SOUS_ADMIN; // Force sous admin type
    
    const sousAdmin = await this.adminService.createAdmin(adminData);
    return {
      success: true,
      message: 'Sous admin user created successfully',
      data: sousAdmin,
    };
  }

  /**
   * Update admin user (Admin only for admin users, Admin only for sous admin users)
   */
  @Put('update/:id')
  async updateAdmin(
    @Param('id') adminId: string,
    @Body() updateData: Partial<CreateAdminDto>,
    @Request() req: ProtectedRequest,
  ) {
    const currentUser = req.session.user;
    
    // Check if current user has permission to update the target admin
    const allAdmins = await this.adminService.getAllAdmins();
    const targetAdmin = allAdmins.find(admin => admin._id.toString() === adminId);
    if (!targetAdmin) {
      throw new BadRequestException('Admin user not found');
    }

    // Only admins can update other admin users
    if (targetAdmin.type === RoleCode.ADMIN && currentUser.type !== RoleCode.ADMIN) {
      throw new BadRequestException('Only admins can update admin users');
    }

    // Prevent type changes that would escalate privileges
    if (updateData.type && updateData.type === RoleCode.ADMIN && currentUser.type !== RoleCode.ADMIN) {
      throw new BadRequestException('Only admins can promote users to admin role');
    }

    const updatedAdmin = await this.adminService.updateAdmin(adminId, updateData);
    return {
      success: true,
      message: 'Admin user updated successfully',
      data: updatedAdmin,
    };
  }

  /**
   * Delete admin user (Admin only)
   */
  @Delete('delete/:id')
  @UseGuards(AdminOnlyGuard)
  async deleteAdmin(@Param('id') adminId: string, @Request() req: ProtectedRequest) {
    const currentUserId = req.session.user._id.toString();
    const result = await this.adminService.deleteAdmin(adminId, currentUserId);
    
    return {
      success: true,
      ...result,
    };
  }

  /**
   * Change admin password
   */
  @Put('change-password/:id')
  @UseGuards(SousAdminGuard)
  async changeAdminPassword(
    @Param('id') adminId: string,
    @Body() passwordData: { currentPassword: string; newPassword: string },
    @Request() req: ProtectedRequest,
  ) {
    const currentUser = req.session.user;
    
    // Users can only change their own password unless they're admin
    if (adminId !== currentUser._id.toString() && currentUser.type !== RoleCode.ADMIN) {
      throw new BadRequestException('You can only change your own password');
    }

    const result = await this.adminService.changeAdminPassword(
      adminId,
      passwordData.currentPassword,
      passwordData.newPassword,
    );
    
    return {
      success: true,
      ...result,
    };
  }

  /**
   * Get current admin/sous admin user info
   */
  @Get('profile')
  @UseGuards(SousAdminGuard)
  async getProfile(@Request() req: ProtectedRequest) {
    const user = req.session.user;
    
    return {
      success: true,
      data: {
        ...user,
        privileges: {
          isAdmin: this.adminService.isFullAdmin(user.type as RoleCode),
          isSousAdmin: this.adminService.isSousAdmin(user.type as RoleCode),
          hasAdminPrivileges: this.adminService.hasAdminPrivileges(user.type as RoleCode),
        },
      },
    };
  }

  /**
   * Check admin permissions for a specific action
   */
  @Post('check-permission')
  @UseGuards(SousAdminGuard)
  async checkPermission(
    @Body() permissionData: { action: string },
    @Request() req: ProtectedRequest,
  ) {
    const user = req.session.user;
    const userType = user.type as RoleCode;
    
    // Define permission matrix
    const permissions = {
      // Actions that only full admins can perform
      'CREATE_ADMIN': this.adminService.isFullAdmin(userType),
      'DELETE_ADMIN': this.adminService.isFullAdmin(userType),
      'MANAGE_SYSTEM_SETTINGS': this.adminService.isFullAdmin(userType),
      'VIEW_FINANCIAL_REPORTS': this.adminService.isFullAdmin(userType),
      'MANAGE_PAYMENT_GATEWAYS': this.adminService.isFullAdmin(userType),
      
      // Actions that both admin and sous admin can perform
      'VIEW_USERS': this.adminService.hasAdminPrivileges(userType),
      'MANAGE_BIDS': this.adminService.hasAdminPrivileges(userType),
      'VIEW_NOTIFICATIONS': this.adminService.hasAdminPrivileges(userType),
      'MODERATE_CONTENT': this.adminService.hasAdminPrivileges(userType),
      'VIEW_BASIC_STATS': this.adminService.hasAdminPrivileges(userType),
      'MANAGE_CATEGORIES': this.adminService.hasAdminPrivileges(userType),
      
      // Limited actions for sous admin
      'CREATE_SOUS_ADMIN': this.adminService.isFullAdmin(userType),
      'UPDATE_USER_STATUS': this.adminService.hasAdminPrivileges(userType),
      'SEND_NOTIFICATIONS': this.adminService.hasAdminPrivileges(userType),
    };
    
    const hasPermission = permissions[permissionData.action] || false;
    
    return {
      success: true,
      hasPermission,
      userType,
      action: permissionData.action,
    };
  }
}
