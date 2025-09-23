// File: backend/src/modules/otp/otp.service.ts (MERGED - Development Mode & Carrier Detection Fixes)
import { ForbiddenException, Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Otp, OtpType } from './schema/otp.schema';
import { Model, Types } from 'mongoose';
import { User } from '../user/schema/user.schema';
import { v4 as uuid } from 'uuid';
import { SmsService } from './sms.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES) || 5;
  private readonly MAX_OTP_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS_PER_DAY) || 10;
  private readonly RATE_LIMIT_WINDOW = (parseInt(process.env.OTP_RATE_LIMIT_MINUTES) || 1) * 60000; // Convert to ms
  private readonly isDevelopment = process.env.NODE_ENV === 'development';

  constructor(
    @InjectModel(Otp.name) private readonly otpModel: Model<Otp>,
    private readonly smsService: SmsService,
  ) {
    this.logger.log(`🔧 OTP Service initialized in ${this.isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);
    this.logger.log(`⏰ OTP Expiry: ${this.OTP_EXPIRY_MINUTES} minutes`);
    this.logger.log(`🔄 Rate Limit: ${this.RATE_LIMIT_WINDOW / 60000} minutes`);
    this.logger.log(`📊 Max daily attempts: ${this.MAX_OTP_ATTEMPTS}`);
  }

  async createNumericOtp(user: User, type: OtpType): Promise<Otp> {
    this.logger.log(`🔢 Generating OTP for user: ${user._id}, type: ${type}`);
    
    // Delete any existing OTPs of the same type for this user
    const deletedCount = await this.otpModel.deleteMany({ user: user._id, type });
    if (deletedCount.deletedCount > 0) {
      this.logger.log(`🗑️  Deleted ${deletedCount.deletedCount} existing OTP(s) for user`);
    }

    let code: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      if (attempts >= maxAttempts) {
        this.logger.error(`❌ Unable to generate unique OTP code for user: ${user._id} after ${maxAttempts} attempts`);
        throw new BadRequestException('Unable to generate unique OTP code');
      }
      code = Math.floor(10000 + Math.random() * 90000).toString(); // Generate 5-digit code
      attempts++;
    } while (await this.otpModel.findOne({ code }));

    if (this.isDevelopment) {
      this.logger.log('');
      this.logger.log('🔢 ================ DEVELOPMENT OTP ================');
      this.logger.log(`📱 Phone: ${user.phone}`);
      this.logger.log(`🔑 OTP Code: ${code}`);
      this.logger.log(`📋 Type: ${type}`);
      this.logger.log(`👤 User ID: ${user._id}`);
      this.logger.log(`⏰ Valid for: ${this.OTP_EXPIRY_MINUTES} minutes`);
      this.logger.log('==================================================');
      this.logger.log('');
    }

    try {
      const otp = await this.otpModel.create({ 
        code, 
        user: user._id, 
        type,
        expired: false,
        isUsed: false
      });

      this.logger.log(`✅ OTP created successfully: ${otp._id}`);
      return otp;
    } catch (error) {
      this.logger.error(`❌ Failed to create OTP for user ${user._id}: ${error.message}`);
      throw new BadRequestException('Failed to create OTP');
    }
  }

  async validateByCode(code: string, user: User): Promise<Otp | null> {
    this.logger.log(`🔍 Validating OTP for user: ${user._id}, code: ${code}`);
    
    try {
      const otp = await this.otpModel.findOne({
        user: user._id,
        code: code,
        isUsed: false,
        expired: false,
      });

      if (!otp) {
        this.logger.warn(`⚠️  OTP not found or already used: user=${user._id}, code=${code}`);
        return null;
      }

      // Check if OTP is expired
      const now = new Date();
      const otpCreatedAt = new Date(otp.createdAt);
      const diffInMinutes = (now.getTime() - otpCreatedAt.getTime()) / (1000 * 60);

      if (diffInMinutes > this.OTP_EXPIRY_MINUTES) {
        this.logger.warn(`⏰ OTP expired: user=${user._id}, code=${code}, age=${diffInMinutes.toFixed(1)} minutes`);
        await this.otpModel.updateOne(
          { _id: otp._id },
          { expired: true }
        );
        return null;
      }

      this.logger.log(`✅ OTP validation successful: user=${user._id}, remaining_time=${(this.OTP_EXPIRY_MINUTES - diffInMinutes).toFixed(1)} minutes`);
      return otp;
    } catch (error) {
      this.logger.error(`❌ Error validating OTP for user ${user._id}: ${error.message}`);
      return null;
    }
  }

  async markAsUsed(otpId: Types.ObjectId): Promise<void> {
    try {
      const result = await this.otpModel.updateOne(
        { _id: otpId },
        { 
          isUsed: true, 
          usedAt: new Date() 
        }
      );

      if (result.modifiedCount === 0) {
        this.logger.warn(`⚠️  Failed to mark OTP as used (not found): ${otpId}`);
        throw new BadRequestException('Failed to mark OTP as used');
      }

      this.logger.log(`✅ OTP marked as used: ${otpId}`);
    } catch (error) {
      this.logger.error(`❌ Error marking OTP as used ${otpId}: ${error.message}`);
      throw error;
    }
  }

  async createOtpAndSendSMS(user: User, type: OtpType): Promise<void> {
    try {
      // Check rate limiting first
      await this.checkRateLimit(user, type);

      // Generate OTP
      const otp = await this.createNumericOtp(user, type);
      
      // Map OTP type to message type for SMS service
      let messageType: string;
      switch (type) {
        case OtpType.PHONE_CONFIRMATION:
          messageType = 'phone_confirmation';
          break;
        case OtpType.FORGOT_PASSWORD:
          messageType = 'password_reset';
          break;
        case OtpType.ORDER_PICKUP:
          messageType = 'order_pickup';
          break;
        case OtpType.ORDER_DELIVERY:
          messageType = 'order_delivery';
          break;
        default:
          messageType = 'verification';
      }
      
      // Send real OTP SMS using improved SMS service
      const smsResult = await this.smsService.sendRealOtp(user.phone, otp.code, messageType);
      
      if (smsResult.success) {
        this.logger.log(`✅ Real OTP SMS sent successfully to ${user.phone} (type: ${type})`);
        this.logger.log(`📊 Credits used: ${smsResult.details?.creditsUsed || (this.isDevelopment ? 0 : 1)}`);
      } else {
        this.logger.error(`❌ Real OTP SMS failed for ${user.phone}: ${smsResult.message}`);
        throw new BadRequestException(`Failed to send OTP SMS: ${smsResult.message}`);
      }
      
      if (this.isDevelopment) {
        this.logger.log('');
        this.logger.log('💡 DEVELOPMENT MODE:');
        this.logger.log('   • SMS was logged instead of sent (no credits used)');
        this.logger.log('   • Use the OTP code shown above for testing');
        this.logger.log('   • Switch NODE_ENV=production for real SMS sending');
        this.logger.log('');
      }
      
    } catch (error) {
      this.logger.error(`❌ Failed to create and send OTP for user ${user._id}: ${error.message}`);
      throw error;
    }
  }


  async resendPhoneConfirmationOtp(user: User): Promise<void> {
    if (user.isPhoneVerified) {
      this.logger.warn(`⚠️  Attempted to resend OTP for already verified phone: ${user.phone}`);
      throw new ForbiddenException('Phone number is already verified');
    }

    try {
      this.logger.log(`🔄 Resending phone confirmation OTP for user: ${user._id}`);
      await this.createOtpAndSendSMS(user, OtpType.PHONE_CONFIRMATION);
      this.logger.log(`✅ Phone confirmation OTP resent successfully`);
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error; // Re-throw rate limiting errors
      }
      this.logger.error(`❌ Failed to resend phone confirmation OTP for user ${user._id}: ${error.message}`);
      throw new BadRequestException('Failed to resend OTP');
    }
  }

  private async checkRateLimit(user: User, type: OtpType): Promise<void> {
    const carrier = this.detectCarrier(user.phone);
    
    // Adjust rate limiting based on carrier reliability and development mode
    let rateLimitWindow = this.RATE_LIMIT_WINDOW;
    
    if (!this.isDevelopment) {
      // In production, apply carrier-specific rate limits
      if (carrier === 'Djezzy') {
        rateLimitWindow = this.RATE_LIMIT_WINDOW * 3; // Triple the rate limit window for Djezzy
      } else if (carrier === 'Ooredoo') {
        rateLimitWindow = this.RATE_LIMIT_WINDOW * 1.5; // 1.5x rate limit for Ooredoo
      }
    } else {
      // In development, use relaxed rate limiting for testing
      rateLimitWindow = Math.max(this.RATE_LIMIT_WINDOW / 2, 30000); // Minimum 30 seconds
      this.logger.log(`Development mode: Using relaxed rate limit of ${rateLimitWindow / 1000} seconds`);
    }
    
    // Check if user has requested OTP too frequently
    const recentOtp = await this.otpModel.findOne({
      user: user._id,
      type: type,
      createdAt: { $gte: new Date(Date.now() - rateLimitWindow) } // Within rate limit window
    });

    if (recentOtp) {
      let waitTime: string;
      if (!this.isDevelopment) {
        if (carrier === 'Djezzy') {
          waitTime = '3 minutes';
        } else if (carrier === 'Ooredoo') {
          waitTime = '90 seconds';
        } else {
          waitTime = '1 minute';
        }
      } else {
        waitTime = `${rateLimitWindow / 1000} seconds (development)`;
      }
      
      this.logger.warn(`Rate limit exceeded for user: ${user._id}, type: ${type}, carrier: ${carrier}`);
      throw new ForbiddenException(`Please wait ${waitTime} before requesting another OTP (${carrier} network)`);
    }

    // Check daily limit (adjusted for development)
    const dailyLimit = this.isDevelopment ? this.MAX_OTP_ATTEMPTS * 10 : this.MAX_OTP_ATTEMPTS; // 10x limit in development
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dailyOtpCount = await this.otpModel.countDocuments({
      user: user._id,
      type: type,
      createdAt: { $gte: today }
    });

    if (dailyOtpCount >= dailyLimit) {
      const limitType = this.isDevelopment ? 'development daily' : 'daily';
      this.logger.warn(`${limitType} OTP limit exceeded for user: ${user._id}, type: ${type} (${dailyOtpCount}/${dailyLimit})`);
      throw new ForbiddenException(`${limitType} OTP limit exceeded. Please try again tomorrow.`);
    }
    
    this.logger.log(`Rate limit check passed: ${dailyOtpCount}/${dailyLimit} daily, carrier: ${carrier}`);
  }

  // FIXED: Correct Algeria Carrier Detection
  private detectCarrier(phone: string): string {
    const cleanPhone = phone.replace(/[^\d]/g, '');
    let localNumber: string;
    
    // Extract local number (9 digits)
    if (cleanPhone.startsWith('213')) {
      localNumber = cleanPhone.substring(3);
    } else if (cleanPhone.startsWith('0')) {
      localNumber = cleanPhone.substring(1);
    } else {
      localNumber = cleanPhone;
    }
    
    if (localNumber.length !== 9) {
      return 'Unknown';
    }
    
    // CORRECT Algeria Mobile Carrier Prefixes
    const firstDigit = localNumber.charAt(0);
    
    if (firstDigit === '5') {
      return 'Ooredoo';  // 05x-xxx-xxxx
    }
    
    if (firstDigit === '6') {
      return 'Mobilis';  // 06x-xxx-xxxx
    }
    
    if (firstDigit === '7') {
      return 'Djezzy';   // 07x-xxx-xxxx
    }
    
    return `Unknown (${firstDigit}x)`;
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async cleanupExpiredOtps(): Promise<void> {
    try {
      const fiveMinutesAgo = new Date(Date.now() - this.OTP_EXPIRY_MINUTES * 60000);
      
      const result = await this.otpModel.updateMany(
        { 
          createdAt: { $lt: fiveMinutesAgo },
          expired: false 
        },
        { expired: true }
      );

      if (result.modifiedCount > 0) {
        this.logger.log(`Cleanup: Marked ${result.modifiedCount} OTPs as expired`);
      }

      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const deleteResult = await this.otpModel.deleteMany({
        createdAt: { $lt: oneDayAgo }
      });

      if (deleteResult.deletedCount > 0) {
        this.logger.log(`Cleanup: Deleted ${deleteResult.deletedCount} old OTPs`);
      }
    } catch (error) {
      this.logger.error(`Error during OTP cleanup: ${error.message}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.otpModel.findOne().limit(1);
      this.logger.log('Database connection: OK');
      
      const smsHealthy = await this.smsService.testConfiguration();
      this.logger.log(`SMS service: ${smsHealthy ? 'OK' : 'FAILED'}`);
      
      if (this.isDevelopment) {
        this.logger.log('Development mode: Health check completed (no live SMS test)');
        return true; // Always return true in development
      }
      
      return smsHealthy;
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      return false;
    }
  }

  async getOtpStats(): Promise<any> {
    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const [totalOtps, dailyOtps, hourlyOtps, expiredOtps, usedOtps] = await Promise.all([
        this.otpModel.countDocuments(),
        this.otpModel.countDocuments({ createdAt: { $gte: oneDayAgo } }),
        this.otpModel.countDocuments({ createdAt: { $gte: oneHourAgo } }),
        this.otpModel.countDocuments({ expired: true }),
        this.otpModel.countDocuments({ isUsed: true })
      ]);

      const carrierStats = await this.getCarrierSpecificStats();

      return {
        total: totalOtps,
        daily: dailyOtps,
        hourly: hourlyOtps,
        expired: expiredOtps,
        used: usedOtps,
        pending: totalOtps - usedOtps - expiredOtps,
        carrierBreakdown: carrierStats,
        environment: this.isDevelopment ? 'development' : 'production',
        configuration: {
          expiryMinutes: this.OTP_EXPIRY_MINUTES,
          rateLimitMinutes: this.RATE_LIMIT_WINDOW / 60000,
          maxDailyAttempts: this.isDevelopment ? this.MAX_OTP_ATTEMPTS * 10 : this.MAX_OTP_ATTEMPTS
        },
        timestamp: now.toISOString()
      };
    } catch (error) {
      this.logger.error(`Failed to get OTP stats: ${error.message}`);
      throw new BadRequestException('Failed to retrieve OTP statistics');
    }
  }

  private async getCarrierSpecificStats(): Promise<any> {
    try {
      const recentOtps = await this.otpModel.find({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }).populate('user', 'phone');

      const carrierStats = {
        djezzy: { sent: 0, used: 0, expired: 0, pending: 0 },
        mobilis: { sent: 0, used: 0, expired: 0, pending: 0 },
        ooredoo: { sent: 0, used: 0, expired: 0, pending: 0 },
        unknown: { sent: 0, used: 0, expired: 0, pending: 0 }
      };

      recentOtps.forEach(otp => {
        if (otp.user && (otp.user as any).phone) {
          const carrier = this.detectCarrier((otp.user as any).phone).toLowerCase();
          const carrierKey = carrierStats[carrier] ? carrier : 'unknown';
          
          carrierStats[carrierKey].sent++;
          if (otp.isUsed) carrierStats[carrierKey].used++;
          if (otp.expired) carrierStats[carrierKey].expired++;
          if (!otp.isUsed && !otp.expired) carrierStats[carrierKey].pending++;
        }
      });

      return carrierStats;
    } catch (error) {
      this.logger.error(`Failed to get carrier stats: ${error.message}`);
      return {
        djezzy: { sent: 0, used: 0, expired: 0, pending: 0 },
        mobilis: { sent: 0, used: 0, expired: 0, pending: 0 },
        ooredoo: { sent: 0, used: 0, expired: 0, pending: 0 },
        unknown: { sent: 0, used: 0, expired: 0, pending: 0 },
        error: 'Could not calculate carrier statistics'
      };
    }
  }

  async getOtpAnalytics(timeframe: 'hour' | 'day' | 'week' = 'day'): Promise<any> {
    try {
      let timeAgo: Date;
      
      switch (timeframe) {
        case 'hour':
          timeAgo = new Date(Date.now() - 60 * 60 * 1000);
          break;
        case 'week':
          timeAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          break;
        default:
          timeAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      }

      const otps = await this.otpModel.find({
        createdAt: { $gte: timeAgo }
      }).populate('user', 'phone').sort({ createdAt: -1 });

      const analytics = {
        totalRequests: otps.length,
        successfulVerifications: otps.filter(otp => otp.isUsed).length,
        expiredOtps: otps.filter(otp => otp.expired).length,
        pendingOtps: otps.filter(otp => !otp.isUsed && !otp.expired).length,
        typeBreakdown: {},
        carrierBreakdown: {
          djezzy: { total: 0, success: 0, expired: 0, pending: 0 },
          mobilis: { total: 0, success: 0, expired: 0, pending: 0 },
          ooredoo: { total: 0, success: 0, expired: 0, pending: 0 },
          unknown: { total: 0, success: 0, expired: 0, pending: 0 }
        },
        timeframe,
        environment: this.isDevelopment ? 'development' : 'production',
        developmentNotes: this.isDevelopment ? 'SMS messages were logged instead of sent' : null,
        generatedAt: new Date().toISOString()
      };

      otps.forEach(otp => {
        if (!analytics.typeBreakdown[otp.type]) {
          analytics.typeBreakdown[otp.type] = { total: 0, success: 0, expired: 0 };
        }
        analytics.typeBreakdown[otp.type].total++;
        if (otp.isUsed) analytics.typeBreakdown[otp.type].success++;
        if (otp.expired) analytics.typeBreakdown[otp.type].expired++;
      });

      otps.forEach(otp => {
        if (otp.user && (otp.user as any).phone) {
          const carrier = this.detectCarrier((otp.user as any).phone).toLowerCase();
          const carrierKey = analytics.carrierBreakdown[carrier] ? carrier : 'unknown';
          
          analytics.carrierBreakdown[carrierKey].total++;
          if (otp.isUsed) analytics.carrierBreakdown[carrierKey].success++;
          if (otp.expired) analytics.carrierBreakdown[carrierKey].expired++;
          if (!otp.isUsed && !otp.expired) analytics.carrierBreakdown[carrierKey].pending++;
        }
      });

      return analytics;
    } catch (error) {
      this.logger.error(`Failed to generate OTP analytics: ${error.message}`);
      throw new BadRequestException('Failed to generate analytics');
    }
  }

  async checkPhoneDeliveryHistory(phone: string): Promise<any> {
    try {
      const carrier = this.detectCarrier(phone);
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const user = await this.otpModel.find({}).populate({
        path: 'user',
        match: { phone: phone }
      });

      const userOtps = user.filter(otp => otp.user !== null);
      
      const recentOtps = userOtps.filter(otp => 
        new Date(otp.createdAt) >= last24Hours
      );

      const stats = {
        phone,
        carrier,
        environment: this.isDevelopment ? 'development' : 'production',
        last24Hours: {
          total: recentOtps.length,
          successful: recentOtps.filter(otp => otp.isUsed).length,
          expired: recentOtps.filter(otp => otp.expired).length,
          pending: recentOtps.filter(otp => !otp.isUsed && !otp.expired).length
        },
        allTime: {
          total: userOtps.length,
          successful: userOtps.filter(otp => otp.isUsed).length,
          expired: userOtps.filter(otp => otp.expired).length
        },
        recommendations: this.getPhoneSpecificRecommendations(phone, carrier, recentOtps),
        developmentNote: this.isDevelopment ? 'In development mode, all SMS messages are logged instead of sent' : null,
        timestamp: new Date().toISOString()
      };

      return stats;
    } catch (error) {
      this.logger.error(`Failed to check delivery history for ${phone}: ${error.message}`);
      throw new BadRequestException('Failed to check delivery history');
    }
  }

  private getPhoneSpecificRecommendations(phone: string, carrier: string, recentOtps: any[]): string[] {
    const recommendations = [];
    
    const failureRate = recentOtps.length > 0 ? 
      (recentOtps.filter(otp => otp.expired).length / recentOtps.length) : 0;
    
    if (this.isDevelopment) {
      recommendations.push('Development mode: SMS messages are logged instead of sent');
      recommendations.push('Switch NODE_ENV=production for real SMS delivery');
      recommendations.push('Use the OTP codes shown in server logs for testing');
    }
    
    if (failureRate > 0.5) {
      recommendations.push(`High failure rate (${Math.round(failureRate * 100)}%) detected`);
      
      if (carrier === 'Djezzy') {
        recommendations.push('Djezzy network issues detected - try longer delays between attempts');
        recommendations.push('Consider using alternative sender IDs like "INFO" or "SMS"');
        recommendations.push('Allow 2-3 minutes for Djezzy delivery');
      } else if (carrier === 'Ooredoo') {
        recommendations.push('Ooredoo may be filtering messages - check spam folder');
        recommendations.push('Try using generic sender IDs like "INFO"');
      } else if (carrier === 'Mobilis') {
        recommendations.push('Unusual Mobilis delivery issues - check phone settings');
        recommendations.push('Mobilis typically has the best delivery rates');
      }
    } else if (failureRate === 0 && recentOtps.length > 0) {
      recommendations.push('Good delivery record for this number');
    } else if (recentOtps.length === 0) {
      recommendations.push('No recent OTP history available');
    }
    
    if (carrier === 'Djezzy') {
      recommendations.push('Allow 2-3 minutes for Djezzy delivery');
      recommendations.push('Djezzy numbers start with 07x');
    } else if (carrier === 'Ooredoo') {
      recommendations.push('Check SMS spam folder for Ooredoo numbers');
      recommendations.push('Ooredoo numbers start with 05x');
      recommendations.push('Ooredoo may filter promotional content');
    } else if (carrier === 'Mobilis') {
      recommendations.push('Mobilis typically has fastest delivery');
      recommendations.push('Mobilis numbers start with 06x');
    }
    
    return recommendations;
  }
}