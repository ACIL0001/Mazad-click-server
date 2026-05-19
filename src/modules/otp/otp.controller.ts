// File: src/modules/otp/otp.controller.ts (FIXED - Type Issue Resolved)
import {
  Body,
  Controller,
  Post,
  Get,
  UseGuards,
  Request,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
  Query,
} from '@nestjs/common';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { OtpConfirmationDto } from './dto/otp_confirmation.dto';
import { PhoneRequestDto } from './dto/phone_request.dto';
import { ProtectedRequest } from 'src/types/request.type';
import { OtpService } from './otp.service';
import { OtpType, OtpDocument } from './schema/otp.schema';
import { UserService } from '../user/user.service';
import { Public } from 'src/common/decorators/public.decorator';
import { Types } from 'mongoose';
import { SessionService } from '../session/session.service';
import { SmsService } from './sms.service';
import { User } from '../user/schema/user.schema';

@Controller('otp')
@Public()
export class OtpController {
  private readonly logger = new Logger(OtpController.name);
  private readonly isDevelopment = process.env.NODE_ENV === 'development';

  constructor(
    private readonly otpService: OtpService,
    private readonly userService: UserService,
    private readonly sessionService: SessionService,
    private readonly smsService: SmsService,
  ) {
    this.logger.log(`OTP Controller initialized in ${this.isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);
  }

  // =================== MAIN OTP ENDPOINTS ===================

  @Post('confirm-phone')
  async confirmPhone(@Body() data: OtpConfirmationDto): Promise<any> {
    this.logger.log(`Phone confirmation attempt for: ${data.phone}`);
    
    try {
      const user = await this._findUserByPhone(data.phone);

      if (user.isPhoneVerified) {
        this.logger.warn(`Phone already verified for user: ${user._id}`);
        throw new BadRequestException('Phone number is already verified');
      }

      const otp = await this._validateOtp(data.code, user, OtpType.PHONE_CONFIRMATION);
      
      await this.otpService.markAsUsed(otp._id);
      this.logger.log(`OTP marked as used for user: ${user._id}`);
      
      const updatedUser = await this.userService.validatePhone(user._id);
      this.logger.log(`Phone verified successfully for user: ${user._id}`);
      
      const tokens = await this.sessionService.CreateSession(updatedUser);
      
      const result = {
        user: updatedUser,
        tokens: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token
        },
        message: 'Phone verification successful'
      };

      if (this.isDevelopment) {
        this.logger.log('Development Success: Phone verification completed');
        this.logger.log(`User ${user._id} phone ${data.phone} verified with OTP ${data.code}`);
      }

      return result;
    } catch (error) {
      this.logger.error(`Phone confirmation failed for ${data.phone}: ${error.message}`);
      throw error;
    }
  }

  @Post('/resend/confirm-phone')
  async resendConfirmPhone(@Body() data: PhoneRequestDto) {
    this.logger.log(`OTP resend request for: ${data.phone}`);
    
    try {
      const user = await this._findUserByPhone(data.phone);
      await this.otpService.resendPhoneConfirmationOtp(user);
      this.logger.log(`OTP resend completed for: ${data.phone}`);
      
      const response = {
        message: 'OTP sent successfully',
        phone: data.phone,
        timestamp: new Date().toISOString()
      };

      return this._addDevelopmentNotes(response);
    } catch (error) {
      this.logger.error(`OTP resend failed for ${data.phone}: ${error.message}`);
      throw error;
    }
  }

  @Post('/reset-password/request')
  async requestPasswordReset(@Body() data: PhoneRequestDto) {
    this.logger.log(`Password reset request for: ${data.phone}`);
    
    try {
      const user = await this._findUserByPhone(data.phone);
      await this.otpService.createOtpAndSendSMS(user, OtpType.FORGOT_PASSWORD);
      this.logger.log(`Password reset OTP sent to: ${data.phone}`);
      
      const response = { 
        message: 'OTP sent for password reset',
        phone: data.phone,
        timestamp: new Date().toISOString()
      };

      return this._addDevelopmentNotes(response);
    } catch (error) {
      this.logger.error(`Password reset request failed for ${data.phone}: ${error.message}`);
      throw error;
    }
  }

  @Post('/reset-password/confirm')
  async confirmPasswordReset(@Body() data: OtpConfirmationDto): Promise<any> {
    this.logger.log(`Password reset confirmation for: ${data.phone}`);
    
    try {
      const user = await this._findUserByPhone(data.phone);
      const otp = await this._validateOtp(data.code, user, OtpType.FORGOT_PASSWORD);
      
      await this.otpService.markAsUsed(otp._id);
      this.logger.log(`Password reset OTP confirmed for user: ${user._id}`);
      
      const result = { 
        message: 'OTP verified for password reset',
        userId: user._id,
        timestamp: new Date().toISOString()
      };

      if (this.isDevelopment) {
        this.logger.log(`Development Success: Password reset OTP verified for ${data.phone}`);
      }

      return result;
    } catch (error) {
      this.logger.error(`Password reset confirmation failed for ${data.phone}: ${error.message}`);
      throw error;
    }
  }

  // =================== DEVELOPMENT & TESTING ENDPOINTS ===================

  @Get('/development-info')
  async getDevelopmentInfo() {
    return {
      environment: this.isDevelopment ? 'development' : 'production',
      smsMode: this.isDevelopment ? 'logged' : 'sent',
      features: {
        mockSms: this.isDevelopment,
        relaxedRateLimiting: this.isDevelopment,
        detailedLogging: this.isDevelopment,
        freeCredits: this.isDevelopment
      },
      instructions: this.isDevelopment ? [
        'SMS messages are logged in server console instead of being sent',
        'Look for OTP codes in the server logs',
        'Rate limiting is relaxed for easier testing',
        'No SMS credits are consumed in development mode',
        'Set NODE_ENV=production to enable real SMS sending'
      ] : [
        'SMS messages are sent via NetBeOpeN gateway',
        'Real SMS credits are consumed',
        'Production rate limiting is applied',
        'Monitor SMS delivery rates and costs'
      ],
      timestamp: new Date().toISOString()
    };
  }

  @Post('/analyze-phone')
  async analyzePhone(@Body() data: PhoneRequestDto) {
    try {
      this.logger.log(`Phone analysis for: ${data.phone}`);
      const analysisResult = await this.smsService.analyzePhoneNumber(data.phone);
      
      return {
        ...analysisResult,
        additionalRecommendations: this.getPhoneSpecificRecommendations(data.phone, analysisResult),
        developmentMode: this.isDevelopment,
        note: 'This endpoint analyzes phone numbers without sending any SMS messages',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Phone analysis failed for ${data.phone}: ${error.message}`);
      throw new BadRequestException(`Phone analysis failed: ${error.message}`);
    }
  }

  @Post('/debug-sms-gateway')
  async debugSmsGateway(@Body() data?: PhoneRequestDto) {
    try {
      this.logger.log('Starting comprehensive SMS gateway debugging...');
      
      const configCheck = {
        NETBEOPEN_API_URL: !!process.env.NETBEOPEN_API_URL,
        NETBEOPEN_WEBSERVICES_USERNAME: !!process.env.NETBEOPEN_WEBSERVICES_USERNAME,
        NETBEOPEN_WEBSERVICES_TOKEN: !!process.env.NETBEOPEN_WEBSERVICES_TOKEN,
        NETBEOPEN_SENDER_ID: !!process.env.NETBEOPEN_SENDER_ID,
      };

      // Test basic connectivity
      const connectivityTest = await this.testSmsConnectivity();
      
      // Analyze phone if provided
      let phoneTestResult = null;
      if (data?.phone) {
        phoneTestResult = await this.performDetailedPhoneTest(data.phone);
      }

      return {
        environment: this.isDevelopment ? 'development' : 'production',
        timestamp: new Date().toISOString(),
        configuration: {
          status: Object.values(configCheck).every(v => v) ? 'complete' : 'incomplete',
          details: configCheck,
          apiUrl: process.env.NETBEOPEN_API_URL || 'NOT_SET',
          username: process.env.NETBEOPEN_WEBSERVICES_USERNAME || 'NOT_SET',
          senderId: process.env.NETBEOPEN_SENDER_ID || 'NOT_SET'
        },
        connectivity: connectivityTest,
        phoneTest: phoneTestResult,
        developmentMode: this.isDevelopment,
        recommendations: this.generateDebuggingRecommendations(configCheck, connectivityTest, phoneTestResult)
      };
    } catch (error) {
      this.logger.error(`SMS gateway debugging failed: ${error.message}`);
      return {
        error: error.message,
        timestamp: new Date().toISOString(),
        recommendations: ['Check server logs for detailed error information', 'Verify all environment variables are set correctly']
      };
    }
  }

  private async testSmsConnectivity(): Promise<any> {
    try {
      const response = await this.smsService.getAccountBalance();
      return {
        status: 'success',
        message: 'API endpoint is reachable',
        details: response
      };
    } catch (error) {
      return {
        status: 'failed',
        message: 'Failed to connect to SMS gateway',
        error: error.message
      };
    }
  }

  private async performDetailedPhoneTest(phone: string): Promise<any> {
    try {
      const carrier = this.detectCarrier(phone);
      const phoneVariations = this.getPhoneVariations(phone);
      const isValid = this.isValidPhoneNumber(phone);
      
      return {
        phone: phone,
        carrier: carrier,
        isValid: isValid,
        phoneVariations: phoneVariations,
        status: 'phone_analysis_complete',
        message: `Phone number analysis completed for ${carrier} carrier`,
        recommendations: this.getCarrierRecommendations(carrier),
        environment: this.isDevelopment ? 'development' : 'production'
      };
    } catch (error) {
      return {
        status: 'failed',
        message: `Phone analysis failed: ${error.message}`,
        phone: phone
      };
    }
  }

  private getPhoneVariations(phone: string): string[] {
    const cleanPhone = phone.replace(/[^\d]/g, '');
    const variations = new Set<string>();
    
    let localPart = '';
    if (cleanPhone.startsWith('213') && cleanPhone.length === 12) {
      localPart = cleanPhone.substring(3);
    } else if (cleanPhone.startsWith('0') && cleanPhone.length === 10) {
      localPart = cleanPhone.substring(1);
    } else if (cleanPhone.length === 9) {
      localPart = cleanPhone;
    }
    
    if (localPart) {
      variations.add(`213${localPart}`);
      variations.add(`+213${localPart}`);
      variations.add(`0${localPart}`);
      variations.add(localPart);
    }
    
    return Array.from(variations);
  }

  private isValidPhoneNumber(phone: string): boolean {
    const cleanPhone = phone.replace(/[^\d]/g, '');
    let localNumber;
    if (cleanPhone.startsWith('213')) localNumber = cleanPhone.substring(3);
    else if (cleanPhone.startsWith('0')) localNumber = cleanPhone.substring(1);
    else localNumber = cleanPhone;

    return localNumber.length === 9 && /^[5-7]/.test(localNumber);
  }

  private getCarrierRecommendations(carrier: string): string[] {
    const recommendations = {
      'Djezzy': [
        'Allow 2-3 minutes for message delivery',
        'Check SMS storage on device',
        'Djezzy may have delays during peak hours'
      ],
      'Mobilis': [
        'Usually fastest delivery (30 seconds - 1 minute)',
        'Most reliable carrier for SMS',
        'Excellent delivery rates'
      ],
      'Ooredoo': [
        'Allow 1-2 minutes for delivery',
        'Check SMS spam folder',
        'May filter promotional messages'
      ]
    };
    return recommendations[carrier] || ['Standard SMS delivery expected'];
  }

  private generateDebuggingRecommendations(configCheck: any, connectivityTest: any, phoneTest: any): string[] {
    const recommendations: string[] = [];
    
    if (!Object.values(configCheck).every(v => v)) {
      recommendations.push('❌ Complete missing environment variables configuration');
      if (!configCheck.NETBEOPEN_API_URL) recommendations.push('  - Set NETBEOPEN_API_URL');
      if (!configCheck.NETBEOPEN_WEBSERVICES_USERNAME) recommendations.push('  - Set NETBEOPEN_WEBSERVICES_USERNAME');
      if (!configCheck.NETBEOPEN_WEBSERVICES_TOKEN) recommendations.push('  - Set NETBEOPEN_WEBSERVICES_TOKEN');
      if (!configCheck.NETBEOPEN_SENDER_ID) recommendations.push('  - Set NETBEOPEN_SENDER_ID');
    }
    
    if (connectivityTest?.status === 'failed') {
      recommendations.push('❌ Fix connectivity to SMS gateway');
      recommendations.push('  - Verify API URL is correct');
      recommendations.push('  - Check network/firewall settings');
      recommendations.push('  - Validate credentials with SMS provider');
    }
    
    if (phoneTest?.status === 'failed') {
      recommendations.push('❌ Fix SMS sending functionality');
      recommendations.push('  - Check phone number format');
      recommendations.push('  - Verify carrier compatibility');
      recommendations.push('  - Review SMS gateway logs');
    }
    
    if (this.isDevelopment) {
      recommendations.push('💡 Development mode is active');
      recommendations.push('  - SMS messages are logged instead of sent');
      recommendations.push('  - Set NODE_ENV=production for real SMS testing');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('✅ Configuration appears correct');
      recommendations.push('✅ Connectivity test passed');
      recommendations.push('✅ Ready for SMS sending');
    }
    
    return recommendations;
  }

  @Post('/test-sms-configuration')
  async testSmsConfiguration(@Body() data?: PhoneRequestDto) {
    try {
      this.logger.log('Testing SMS configuration...');
      
      const configTest = await this.smsService.testConfiguration();
      const serviceStatus = await this.smsService.getServiceStatus();
      
      let phoneTest = null;
      if (data?.phone) {
        phoneTest = await this.smsService.analyzePhoneNumber(data.phone);
      }

      const result = {
        configurationValid: configTest,
        serviceStatus: serviceStatus,
        phoneTest: phoneTest,
        environment: this.isDevelopment ? 'development' : 'production',
        creditsWillBeUsed: !this.isDevelopment,
        timestamp: new Date().toISOString()
      };

      if (this.isDevelopment) {
        result['developmentNotes'] = [
          'Configuration test passed (mock mode)',
          'No real SMS credits consumed',
          'SMS messages will be logged to console',
          'Switch to production for real SMS testing'
        ];
      }

      return result;
    } catch (error) {
      this.logger.error(`SMS configuration test failed: ${error.message}`);
      throw new BadRequestException(`SMS configuration test failed: ${error.message}`);
    }
  }

  @Post('/send-real-otp')
  async sendRealOtp(@Body() data: PhoneRequestDto) {
    try {
      this.logger.log(`Real OTP request for: ${data.phone}`);
      
      const user = await this._findUserByPhone(data.phone);
      if (!user) {
        throw new NotFoundException('User not found for this phone number');
      }

      // Send real OTP using the improved SMS service
      await this.otpService.createOtpAndSendSMS(user, OtpType.PHONE_CONFIRMATION);
      
      return {
        message: 'Real OTP sent successfully',
        phone: data.phone,
        environment: this.isDevelopment ? 'development' : 'production',
        creditsUsed: this.isDevelopment ? 0 : 1,
        note: this.isDevelopment ? 'Check server logs for OTP code (development mode)' : 'OTP sent to your phone',
        nextStep: 'Use the received OTP code with POST /otp/confirm-phone',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Real OTP sending failed for ${data.phone}: ${error.message}`);
      throw error;
    }
  }

  // =================== HEALTH CHECK & STATUS ENDPOINTS ===================

  @Get('/health-check')
  async healthCheck() {
    try {
      const isOtpHealthy = await this.otpService.healthCheck();
      const smsTestResult = await this.smsService.testSmsConnection();
      
      const result = {
        status: isOtpHealthy && smsTestResult.success ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        environment: this.isDevelopment ? 'development' : 'production',
        services: {
          otp: isOtpHealthy,
          sms: smsTestResult.success,
          smsDetails: smsTestResult
        },
        developmentMode: {
          active: this.isDevelopment,
          benefits: this.isDevelopment ? [
            'No SMS credits consumed',
            'OTP codes logged to console',
            'Relaxed rate limiting for testing',
            'Mock SMS delivery simulation'
          ] : null
        }
      };

      this.logger.log('Health check completed:', result.status);
      return result;
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        environment: this.isDevelopment ? 'development' : 'production',
        error: error.message,
        services: {
          otp: false,
          sms: false
        },
        developmentMode: {
          active: this.isDevelopment,
          note: this.isDevelopment ? 'Even in development mode, basic configuration should be present' : null
        }
      };
    }
  }

  @Get('/sms-status')
  async getSmsStatus() {
    try {
      const environment = this.isDevelopment ? 'development' : 'production';
      const configTest = await this.smsService.testConfiguration();
      
      const envStatus = {
        NETBEOPEN_API_URL: !!process.env.NETBEOPEN_API_URL,
        NETBEOPEN_WEBSERVICES_USERNAME: !!process.env.NETBEOPEN_WEBSERVICES_USERNAME,
        NETBEOPEN_WEBSERVICES_TOKEN: !!process.env.NETBEOPEN_WEBSERVICES_TOKEN,
        NETBEOPEN_SENDER_ID: !!process.env.NETBEOPEN_SENDER_ID,
      };

      const otpStats = await this.otpService.getOtpStats();

      return {
        environment,
        smsMode: this.isDevelopment ? 'development (logged)' : 'production (sent)',
        configurationValid: configTest,
        environmentVariables: envStatus,
        otpStatistics: otpStats,
        timestamp: new Date().toISOString(),
        recommendations: this.getSmsRecommendations(environment, envStatus),
        nextSteps: this.getNextSteps(environment, envStatus, configTest),
        developmentFeatures: this.isDevelopment ? {
          mockSmsDelivery: true,
          freeCredits: true,
          consoleLogging: true,
          relaxedRateLimiting: true
        } : null
      };
    } catch (error) {
      this.logger.error(`SMS status check failed: ${error.message}`);
      throw new BadRequestException(`SMS status check failed: ${error.message}`);
    }
  }

  @Post('/validate-phone')
  async validatePhone(@Body() data: PhoneRequestDto) {
    try {
      const phoneRegex = /^(\+213|213|0)?[5-7][0-9]{8}$/;
      const isValid = phoneRegex.test(data.phone.replace(/\s+/g, ''));
      
      let cleanPhone = data.phone.replace(/[^\d+]/g, '');
      
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '+213' + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith('213') && !cleanPhone.startsWith('+213')) {
        cleanPhone = '+' + cleanPhone;
      } else if (!cleanPhone.startsWith('+213') && cleanPhone.length === 9) {
        cleanPhone = '+213' + cleanPhone;
      }

      const carrier = this.detectCarrier(data.phone);
      
      return {
        originalPhone: data.phone,
        cleanPhone: cleanPhone,
        isValid: isValid,
        carrier: carrier,
        format: 'Algerian mobile format expected',
        examples: ['+213660295655', '0660295655', '213660295655'],
        supportedNetworks: [
          'Mobilis (06x) - e.g., 0660295655',
          'Djezzy (07x) - e.g., 0770123456', 
          'Ooredoo (05x) - e.g., 0557632829'
        ],
        developmentMode: this.isDevelopment,
        developmentNote: this.isDevelopment ? 'SMS will be logged instead of sent' : null,
        timestamp: new Date().toISOString(),
        notes: isValid ? `Valid ${carrier} phone number format` : 'Invalid Algerian phone number format'
      };
    } catch (error) {
      this.logger.error(`Phone validation failed: ${error.message}`);
      throw new BadRequestException(`Phone validation failed: ${error.message}`);
    }
  }

  @Get('/statistics')
  async getOtpStatistics() {
    try {
      const stats = await this.otpService.getOtpStats();
      
      return {
        ...stats,
        breakdown: {
          successRate: stats.used > 0 ? ((stats.used / stats.total) * 100).toFixed(2) + '%' : '0%',
          expiredRate: stats.expired > 0 ? ((stats.expired / stats.total) * 100).toFixed(2) + '%' : '0%',
          activeOtps: stats.total - stats.used - stats.expired
        },
        environment: this.isDevelopment ? 'development' : 'production',
        developmentImpact: this.isDevelopment ? {
          smsCreditsConsumed: 0,
          actualSmssSent: 0,
          loggedSmsCount: stats.total
        } : {
          smsCreditsConsumed: 'unknown',
          actualSmssSent: stats.total,
          loggedSmsCount: 0
        }
      };
    } catch (error) {
      this.logger.error(`Statistics retrieval failed: ${error.message}`);
      throw new BadRequestException(`Failed to retrieve statistics: ${error.message}`);
    }
  }

  @Post('/cleanup')
  async triggerCleanup() {
    try {
      await this.otpService.cleanupExpiredOtps();
      const stats = await this.otpService.getOtpStats();
      
      return {
        message: 'Cleanup completed successfully',
        timestamp: new Date().toISOString(),
        currentStats: stats,
        environment: this.isDevelopment ? 'development' : 'production'
      };
    } catch (error) {
      this.logger.error(`Manual cleanup failed: ${error.message}`);
      throw new BadRequestException(`Cleanup failed: ${error.message}`);
    }
  }

  @Get('/carrier-insights')
  async getCarrierInsights() {
    return {
      carriers: {
        djezzy: {
          prefix: '07x',
          name: 'Djezzy',
          reliability: 'Medium',
          avgDeliveryTime: '2-3 minutes',
          commonIssues: [
            'Network congestion during peak hours',
            'SMS storage full on device',
            'Sender ID filtering',
            'Content filtering'
          ],
          tips: [
            'Retry after 2-3 minutes if not received',
            'Check phone storage space',
            'Use generic sender IDs like INFO or SMS',
            'Allow extra time during peak hours'
          ],
          developmentBehavior: this.isDevelopment ? 'Simulates 2-3 second delay' : 'Real network delivery'
        },
        mobilis: {
          prefix: '06x',
          name: 'Mobilis',
          reliability: 'High',
          avgDeliveryTime: '30 seconds - 1 minute',
          commonIssues: [
            'Very few delivery issues',
            'Rare network outages'
          ],
          tips: [
            'Generally most reliable carrier for SMS',
            'Best choice for critical notifications'
          ],
          developmentBehavior: this.isDevelopment ? 'Simulates 0.5 second delay' : 'Real network delivery'
        },
        ooredoo: {
          prefix: '05x',
          name: 'Ooredoo',
          reliability: 'Medium-High',
          avgDeliveryTime: '1-2 minutes',
          commonIssues: [
            'May filter promotional messages',
            'Sender ID restrictions',
            'Content filtering for bulk messages'
          ],
          tips: [
            'Use approved sender IDs',
            'Check SMS spam folder',
            'Avoid promotional language'
          ],
          developmentBehavior: this.isDevelopment ? 'Simulates 1 second delay' : 'Real network delivery'
        }
      },
      environment: this.isDevelopment ? 'development' : 'production',
      developmentNote: this.isDevelopment ? 'All carrier behaviors are simulated for testing' : null,
      timestamp: new Date().toISOString()
    };
  }

  // =================== PRIVATE LOGIC HELPERS ===================

  private async _findUserByPhone(phone: string, allowNotFound = false): Promise<User> {
    const user = await this.userService.findByLogin(phone);
    if (!user) {
      this.logger.warn(`User not found for phone: ${phone}`);
      if (allowNotFound) return null;
      throw new NotFoundException('User not found for this phone number');
    }
    return user;
  }

  // FIXED: Changed return type to match what the service actually returns
  private async _validateOtp(code: string, user: User, expectedType: OtpType): Promise<any> {
    const otp = await this.otpService.validateByCode(code, user);
    if (!otp) {
      this.logger.warn(`Invalid OTP attempt for user: ${user._id}, code: ${code}`);
      throw new BadRequestException('Invalid or expired OTP');
    }
    if (otp.type !== expectedType) {
      this.logger.warn(`OTP type mismatch for user: ${user._id}, expected: ${expectedType}, got: ${otp.type}`);
      throw new BadRequestException('OTP type mismatch');
    }
    return otp;
  }
  
  private _addDevelopmentNotes(response: any): any {
    if (this.isDevelopment) {
      return {
        ...response,
        developmentNote: 'SMS was logged instead of sent - check server logs for OTP code',
        environment: 'development',
      };
    }
    return response;
  }
  
  // =================== PRIVATE INFO HELPERS ===================

  private detectCarrier(phone: string): string {
    const cleanPhone = phone.replace(/[^\d]/g, '');
    let localNumber: string;
    
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
    
    const firstDigit = localNumber.charAt(0);
    
    if (firstDigit === '5') return 'Ooredoo';
    if (firstDigit === '6') return 'Mobilis';
    if (firstDigit === '7') return 'Djezzy';
    
    return `Unknown (${firstDigit}x)`;
  }

  private getPhoneSpecificRecommendations(phone: string, testResult: any): string[] {
    const recommendations: string[] = [];
    const carrier = testResult.carrier || this.detectCarrier(phone);
    
    if (this.isDevelopment) {
      recommendations.push('Development mode: All SMS messages are logged instead of sent');
      recommendations.push('No SMS credits are consumed during testing');
      recommendations.push('OTP codes appear in server console logs');
    }
    
    if (carrier === 'Djezzy') {
      recommendations.push('Djezzy numbers may experience delays - allow 2-3 minutes');
      recommendations.push('Check phone SMS storage if issues persist');
      recommendations.push('Djezzy numbers start with 07x');
    } else if (carrier === 'Mobilis') {
      recommendations.push('Mobilis generally has excellent delivery rates');
      recommendations.push('Expect delivery within 30 seconds to 1 minute');
      recommendations.push('Mobilis numbers start with 06x');
    } else if (carrier === 'Ooredoo') {
      recommendations.push('Ooredoo may filter messages - check spam folder');
      recommendations.push('Allow 1-2 minutes for delivery');
      recommendations.push('Ooredoo numbers start with 05x');
    } else {
      recommendations.push('Unknown carrier - verify phone number format');
      recommendations.push('Ensure number is active and reachable');
    }
    
    return recommendations;
  }

  private getSmsRecommendations(environment: string, envStatus: any): string[] {
    const recommendations: string[] = [];

    if (environment === 'development') {
      recommendations.push('Development mode active - SMS messages logged instead of sent');
      recommendations.push('No SMS credits consumed during testing');
      recommendations.push('Set NODE_ENV=production for live SMS sending');
    }

    if (!envStatus.NETBEOPEN_API_URL) recommendations.push('Set NETBEOPEN_API_URL environment variable');
    if (!envStatus.NETBEOPEN_WEBSERVICES_USERNAME) recommendations.push('Set NETBEOPEN_WEBSERVICES_USERNAME environment variable');
    if (!envStatus.NETBEOPEN_WEBSERVICES_TOKEN) recommendations.push('Set NETBEOPEN_WEBSERVICES_TOKEN environment variable');
    if (!envStatus.NETBEOPEN_SENDER_ID) recommendations.push('Set NETBEOPEN_SENDER_ID environment variable');

    if (environment === 'production' && Object.values(envStatus).every(v => v)) {
      recommendations.push('Configuration complete for production SMS sending');
      recommendations.push('Monitor SMS delivery rates and costs');
      recommendations.push('Set up alerts for SMS failures');
    }

    return recommendations;
  }

  private getNextSteps(environment: string, envStatus: any, configTest: boolean): string[] {
    const nextSteps: string[] = [];

    if (environment === 'development') {
      nextSteps.push('1. Test OTP functionality using /send-development-test-otp');
      nextSteps.push('2. Use OTP codes from server logs to test confirmation');
      nextSteps.push('3. Configure production environment variables');
      nextSteps.push('4. Set NODE_ENV=production when ready for live SMS');
    }

    if (!Object.values(envStatus).every(v => v)) {
      nextSteps.push('1. Complete environment variable configuration');
      nextSteps.push('2. Run /test-sms-configuration to verify setup');
    }

    if (environment === 'production' && configTest) {
      nextSteps.push('1. Monitor SMS delivery rates by carrier');
      nextSteps.push('2. Check NetBeOpen account balance regularly');
      nextSteps.push('3. Set up alerts for SMS failures');
      nextSteps.push('4. Use debugging endpoints for delivery issues');
    }

    if (environment === 'production' && !configTest) {
      nextSteps.push('1. Verify NetBeOpen API credentials');
      nextSteps.push('2. Check account balance/credits');
      nextSteps.push('3. Test configuration once credentials are fixed');
    }

    return nextSteps;
  }
}