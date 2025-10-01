// File: src/modules/otp/sms.service.ts (MERGED - Dev-Optimized & Carrier-Aware)
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly isDevelopment: boolean;

  constructor(private readonly httpService: HttpService) {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    
    if (this.isDevelopment) {
      this.logger.log('🔧 DEVELOPMENT MODE: SMS messages will be logged instead of sent');
      this.logger.log('💡 This saves SMS credits while testing OTP functionality');
      // Still validate config in development to ensure production readiness
      this.validateSmsConfigForDevelopment();
    } else {
      this.logger.log('🚀 PRODUCTION MODE: SMS messages will be sent via NetBeOpeN');
      this.validateSmsConfig();
    }
  }

  // =================== PUBLIC API METHODS ===================

  async testConfiguration(): Promise<boolean> {
    if (this.isDevelopment) {
      this.logger.log('🔧 Development mode: Configuration test passed (mock)');
      return true;
    }
    try {
      const testResult = await this.testSmsConnection();
      return testResult.success;
    } catch (error) {
      this.logger.error(`❌ SMS configuration test failed: ${error.message}`);
      return false;
    }
  }

  async sendSms(phone: string, message: string): Promise<void> {
    if (!this.isValidPhoneNumber(phone)) {
      throw new BadRequestException(`Invalid Algerian phone number format: ${phone}`);
    }

    const carrier = this.detectCarrier(phone);
    
    if (this.isDevelopment) {
      this.logger.log('');
      this.logger.log('📱 =================== DEVELOPMENT SMS ===================');
      this.logger.log(`📞 To: ${phone} (${carrier})`);
      this.logger.log(`📄 Message: ${message}`);
      this.logger.log(`🏷️  Sender: ${process.env.NETBEOPEN_SENDER_ID || 'TalabaStore'}`);
      this.logger.log(`⏰ Timestamp: ${new Date().toISOString()}`);
      this.logger.log(`💰 Cost: 0 (Development Mode - No Credits Used)`);
      this.logger.log('========================================================');
      this.logger.log('');
      
      const random = Math.random();
      if (random < 0.05) { // 5% chance of simulated failure
        this.logger.warn(`🧪 Simulated failure for testing (${carrier})`);
        throw new BadRequestException(`Simulated SMS failure for testing purposes`);
      }
      
      const delays = { 'Djezzy': 2000, 'Mobilis': 500, 'Ooredoo': 1000 };
      const delay = delays[carrier] || 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      this.logger.log(`✅ Development SMS "sent" successfully to ${carrier} (simulated ${delay}ms delay)`);
      return;
    }

    try {
      await this.sendWithCarrierOptimization(phone, message);
      this.logger.log(`✅ SMS sent successfully to ${phone} (${carrier})`);
    } catch (error) {
      this.logger.error(`❌ SMS sending failed to ${phone} (${carrier}): ${error.message}`);
      this.logger.error(`[FALLBACK LOG] Failed SMS to: ${phone}`);
      throw error;
    }
  }
  
  async sendRealOtp(phone: string, otpCode: string, messageType: string = 'verification'): Promise<{ success: boolean; message: string; details?: any }> {
    let message: string;
    
    switch (messageType) {
      case 'phone_confirmation':
        message = `Your MazadClick verification code is: ${otpCode}. Valid for 5 minutes. Do not share this code.`;
        break;
      case 'password_reset':
        message = `Your MazadClick password reset code is: ${otpCode}. Valid for 5 minutes. Do not share this code.`;
        break;
      case 'order_pickup':
        message = `Your MazadClick order pickup code is: ${otpCode}. Valid for 5 minutes.`;
        break;
      case 'order_delivery':
        message = `Your MazadClick order delivery code is: ${otpCode}. Valid for 5 minutes.`;
        break;
      default:
        message = `Your MazadClick verification code is: ${otpCode}. Valid for 5 minutes. Do not share this code.`;
    }
    
    if (this.isDevelopment) {
      this.logger.log('🔧 Development mode: SMS will be logged instead of sent');
      this.logger.log(`📱 Real OTP SMS to ${phone}: ${message}`);
      
      return {
        success: true,
        message: '✅ Development mode: OTP logged (no credits used)',
        details: { phone, message, otpCode, mode: 'development', creditsUsed: 0, carrier: this.detectCarrier(phone) }
      };
    }

    try {
      await this.sendSms(phone, message);
      return {
        success: true,
        message: '✅ Real OTP SMS sent successfully (credits used)',
        details: { phone, message, otpCode, mode: 'production', creditsUsed: 1, carrier: this.detectCarrier(phone) }
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ Real OTP SMS failed: ${error.message}`,
        details: { phone, error: error.message, otpCode }
      };
    }
  }

  async analyzePhoneNumber(phone: string): Promise<any> {
    const carrier = this.detectCarrier(phone);
    const phoneVariations = this.formatPhoneForNetBeOpen(phone);
    const isValid = this.isValidPhoneNumber(phone);
    
    this.logger.log(`🔍 Analyzing phone: ${phone}`);
    this.logger.log(`🏷️  Carrier: ${carrier}`);
    this.logger.log(`✅ Valid: ${isValid}`);
    this.logger.log(`🔄 Phone variations: ${JSON.stringify(phoneVariations)}`);
    
    return {
      phone,
      carrier,
      phoneVariations,
      isValid,
      status: 'analysis_complete',
      message: `Phone number analysis completed for ${carrier} carrier`,
      deliveryEstimate: this.getMockDeliveryTime(carrier),
      recommendations: this.getCarrierSpecificTips(carrier),
      environment: this.isDevelopment ? 'development' : 'production',
      timestamp: new Date().toISOString()
    };
  }
  
  async getServiceStatus(): Promise<any> {
    const configTest = await this.testConfiguration();
    const balanceInfo = this.isDevelopment ? await this.getAccountBalance() : 'N/A in production status check';

    return {
      service: 'NetBeOpeN SMS Gateway',
      environment: this.isDevelopment ? 'development' : 'production',
      mode: this.isDevelopment ? '🔧 Development (Mock SMS)' : '🚀 Production (Real SMS)',
      configured: configTest,
      balance: balanceInfo,
      configurationComplete: this.hasAllConfigVariables(),
      timestamp: new Date().toISOString()
    };
  }

  async getAccountBalance(): Promise<any> {
    if (this.isDevelopment) {
      return {
        balance: 'N/A (Development Mode)',
        currency: 'DZD',
        credits: '∞ (Mock)',
        mode: 'development',
        note: 'Switch to production to check real balance'
      };
    }

    try {
      const apiUrl = process.env.NETBEOPEN_API_URL;
      const username = process.env.NETBEOPEN_WEBSERVICES_USERNAME;
      const token = process.env.NETBEOPEN_WEBSERVICES_TOKEN;
      const params = new URLSearchParams({ u: username, h: token, op: 'balance' });
      const response = await lastValueFrom(this.httpService.get(`${apiUrl}?${params.toString()}`, { timeout: 10000 }));
      return { raw: response.data, parsed: this.parseBalanceResponse(response.data), timestamp: new Date().toISOString() };
    } catch (error) {
      this.logger.error('Balance check failed:', error.message);
      return { error: error.message, timestamp: new Date().toISOString() };
    }
  }

  // =================== PRIVATE CORE LOGIC ===================
  
  private async sendWithCarrierOptimization(phone: string, message: string): Promise<void> {
    const carrier = this.detectCarrier(phone);
    this.logger.log(`Sending SMS to ${carrier} number: ${phone}`);

    if (carrier === 'Djezzy') {
      await this.sendToDjezzy(phone, message);
    } else if (carrier === 'Ooredoo') {
      await this.sendToOoredoo(phone, message);
    } else {
      await this.sendViaNestBeOpeNAPI(phone, message);
    }
  }
  
  private async sendToDjezzy(phone: string, message: string): Promise<void> {
    const djezzyFormats = this.getDjezzyPhoneFormats(phone);
    const djezzySenders = ['INFO', 'SMS', process.env.NETBEOPEN_SENDER_ID, null];
    let lastError: any;
    
    for (const phoneFormat of djezzyFormats) {
      for (const sender of djezzySenders) {
        try {
          this.logger.log(`Trying Djezzy: phone=${phoneFormat}, sender=${sender || 'NO_SENDER'}`);
          await this.sendViaNestBeOpeNAPI(phoneFormat, message, sender, 20000);
          return;
        } catch (error) {
          lastError = error;
          this.logger.debug(`Djezzy attempt error: phone=${phoneFormat}, sender=${sender || 'NO_SENDER'}, error=${error.message}`);
        }
      }
    }
    throw new BadRequestException(`All Djezzy SMS attempts failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  private async sendToOoredoo(phone: string, message: string): Promise<void> {
    const ooredooFormats = this.getOoredooPhoneFormats(phone);
    const ooredooSenders = ['INFO', process.env.NETBEOPEN_SENDER_ID, 'SMS'];
    let lastError: any;

    for (const phoneFormat of ooredooFormats) {
      for (const sender of ooredooSenders) {
        try {
          this.logger.log(`Trying Ooredoo: phone=${phoneFormat}, sender=${sender}`);
          await this.sendViaNestBeOpeNAPI(phoneFormat, message, sender, 15000);
          return;
        } catch (error) {
          lastError = error;
          this.logger.debug(`Ooredoo attempt error: phone=${phoneFormat}, sender=${sender}, error=${error.message}`);
        }
      }
    }
    throw new BadRequestException(`All Ooredoo SMS attempts failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  private async sendViaNestBeOpeNAPI(phone: string, message: string, senderId?: string, timeout: number = 15000): Promise<void> {
    const apiUrl = process.env.NETBEOPEN_API_URL;
    const username = process.env.NETBEOPEN_WEBSERVICES_USERNAME;
    const token = process.env.NETBEOPEN_WEBSERVICES_TOKEN;
    const defaultSenderId = process.env.NETBEOPEN_SENDER_ID;

    // Clean and validate inputs
    if (!apiUrl || !username || !token) {
      throw new BadRequestException('SMS gateway configuration is incomplete');
    }

    const finalSenderId = senderId || defaultSenderId || 'MazadClick';
    
    // Log detailed request information for debugging
    this.logger.log(`SMS API Request Details:`);
    this.logger.log(`  URL: ${apiUrl}`);
    this.logger.log(`  Username: ${username}`);
    this.logger.log(`  Token: ${token ? `${token.substring(0, 8)}...` : 'MISSING'}`);
    this.logger.log(`  Phone: ${phone}`);
    this.logger.log(`  Message: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
    this.logger.log(`  Sender ID: ${finalSenderId}`);

    // Try multiple request formats
    const requestFormats = [
      // Format 1: POST with form data (most common)
      () => this.sendPostFormData(apiUrl, username, token, phone, message, finalSenderId, timeout),
      
      // Format 2: GET with query parameters (current method)
      () => this.sendGetRequest(apiUrl, username, token, phone, message, finalSenderId, timeout),
      
      // Format 3: POST with JSON payload
      () => this.sendPostJson(apiUrl, username, token, phone, message, finalSenderId, timeout)
    ];

    let lastError: any;
    
    for (let i = 0; i < requestFormats.length; i++) {
      try {
        this.logger.log(`Attempting SMS request format ${i + 1}...`);
        await requestFormats[i]();
        this.logger.log(`SMS sent successfully using format ${i + 1}`);
        return;
      } catch (error) {
        lastError = error;
        this.logger.warn(`Format ${i + 1} failed: ${error.message}`);
        
        // If it's a timeout or network error, don't try other formats
        if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND') {
          break;
        }
      }
    }

    // All formats failed
    this.logger.error(`All SMS request formats failed. Last error: ${lastError?.message}`);
    throw new BadRequestException(`Failed to send SMS: ${lastError?.message || 'Unknown error'}`);
  }

  private async sendPostFormData(apiUrl: string, username: string, token: string, phone: string, message: string, senderId: string, timeout: number): Promise<void> {
    const formData = new URLSearchParams({
      u: username,
      h: token,
      op: 'pv',
      to: phone,
      msg: message,
      from: senderId
    });

    const response = await lastValueFrom(
      this.httpService.post(apiUrl, formData.toString(), {
        timeout,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'MazadClick-SMS-Service/1.0'
        }
      })
    );

    this.logger.log(`POST Form Response: ${JSON.stringify(response.data)}`);
    
    if (!this.isSuccessResponse(response.data)) {
      throw new BadRequestException(`SMS gateway rejected POST form request: "${response.data}"`);
    }
  }

  private async sendGetRequest(apiUrl: string, username: string, token: string, phone: string, message: string, senderId: string, timeout: number): Promise<void> {
    const params = new URLSearchParams({
      u: username,
      h: token,
      op: 'pv',
      to: phone,
      msg: message,
      from: senderId
    });

    const response = await lastValueFrom(
      this.httpService.get(`${apiUrl}?${params.toString()}`, {
        timeout,
        headers: {
          'User-Agent': 'MazadClick-SMS-Service/1.0'
        }
      })
    );

    this.logger.log(`GET Response: ${JSON.stringify(response.data)}`);
    
    if (!this.isSuccessResponse(response.data)) {
      throw new BadRequestException(`SMS gateway rejected GET request: "${response.data}"`);
    }
  }

  private async sendPostJson(apiUrl: string, username: string, token: string, phone: string, message: string, senderId: string, timeout: number): Promise<void> {
    const payload = {
      u: username,
      h: token,
      op: 'pv',
      to: phone,
      msg: message,
      from: senderId
    };

    const response = await lastValueFrom(
      this.httpService.post(apiUrl, payload, {
        timeout,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MazadClick-SMS-Service/1.0'
        }
      })
    );

    this.logger.log(`POST JSON Response: ${JSON.stringify(response.data)}`);
    
    if (!this.isSuccessResponse(response.data)) {
      throw new BadRequestException(`SMS gateway rejected JSON request: "${response.data}"`);
    }
  }

  private async sendSingleVariation(phone: string, message: string): Promise<any> {
    await this.sendViaNestBeOpeNAPI(phone, message);
    return { status: 'sent', phone, message };
  }
  
  // =================== PRIVATE HELPERS & CONFIG ===================

  private validateSmsConfig(): void {
    const missingVars = this.getMissingConfigVars();
    if (missingVars.length > 0) {
      this.logger.error('❌ Missing required SMS configuration environment variables:');
      missingVars.forEach(v => this.logger.error(`   - ${v}`));
      throw new Error('SMS service configuration is incomplete');
    }
    this.logger.log('✅ SMS service configuration validated successfully');
  }

  private validateSmsConfigForDevelopment(): void {
    const missingVars = this.getMissingConfigVars();
    if (missingVars.length > 0) {
      this.logger.warn('⚠️  Missing SMS configuration variables (needed for production):');
      missingVars.forEach(varName => this.logger.warn(`   - ${varName}`));
      this.logger.warn('🔧 Development mode will continue with mock SMS sending');
    } else {
      this.logger.log('✅ SMS configuration complete (ready for production)');
    }
  }
  
  async testSmsConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    if (this.isDevelopment) {
      return {
        success: true,
        message: '🔧 Development mode - SMS connection test skipped (saves credits)',
        details: { mode: 'development', configurationPresent: this.hasAllConfigVariables() }
      };
    }

    try {
      this.logger.log('🔐 Testing account credentials via balance check...');
      const balanceData = await this.getAccountBalance();
      if (balanceData.error) throw new Error(balanceData.error);
      
      return {
        success: true,
        message: '✅ SMS service configuration appears valid',
        details: { apiReachable: true, credentialsValid: true, balanceResponse: balanceData.raw }
      };
    } catch (error) {
      this.logger.error('❌ SMS connection test failed:', error.message);
      return { success: false, message: `❌ SMS configuration test failed: ${error.message}` };
    }
  }

  private isValidPhoneNumber(phone: string): boolean {
    const cleanPhone = phone.replace(/[^\d]/g, '');
    let localNumber;
    if (cleanPhone.startsWith('213')) localNumber = cleanPhone.substring(3);
    else if (cleanPhone.startsWith('0')) localNumber = cleanPhone.substring(1);
    else localNumber = cleanPhone;

    const isValid = localNumber.length === 9 && /^[5-7]/.test(localNumber);
    this.logger.debug(`📱 Phone validation: ${phone} -> ${isValid ? '✅ Valid' : '❌ Invalid'}`);
    return isValid;
  }
  
  private detectCarrier(phone: string): string {
    const cleanPhone = phone.replace(/[^\d]/g, '');
    let localNumber = cleanPhone;

    if (cleanPhone.startsWith('213')) localNumber = cleanPhone.substring(3);
    else if (cleanPhone.startsWith('0')) localNumber = cleanPhone.substring(1);
    
    if (localNumber.length !== 9) return 'Unknown';
    
    const firstDigit = localNumber.charAt(0);
    if (firstDigit === '5') return 'Ooredoo';
    if (firstDigit === '6') return 'Mobilis';
    if (firstDigit === '7') return 'Djezzy';
    return `Unknown (${firstDigit}x)`;
  }
  
  private formatPhoneForNetBeOpen(phone: string): string[] {
    const cleanPhone = phone.replace(/[^\d]/g, '');
    const formats = new Set<string>();
    let localPart = '';

    if (cleanPhone.startsWith('213') && cleanPhone.length === 12) {
      localPart = cleanPhone.substring(3);
    } else if (cleanPhone.startsWith('0') && cleanPhone.length === 10) {
      localPart = cleanPhone.substring(1);
    } else if (cleanPhone.length === 9) {
      localPart = cleanPhone;
    }
    if (localPart) {
      formats.add(`213${localPart}`);
      formats.add(`+213${localPart}`);
      formats.add(`0${localPart}`);
      formats.add(localPart);
    }
    return Array.from(formats).filter(Boolean);
  }

  private getDjezzyPhoneFormats(phone: string): string[] {
    const cleanPhone = phone.replace(/[^\d]/g, '');
    const formats = new Set<string>();
    let baseNumber = '';
    if(cleanPhone.startsWith('213')) baseNumber = cleanPhone;
    else if (cleanPhone.startsWith('0')) baseNumber = `213${cleanPhone.substring(1)}`;
    else if (cleanPhone.length === 9) baseNumber = `213${cleanPhone}`;
    if(baseNumber) {
        formats.add(baseNumber);
        formats.add(`00${baseNumber}`);
    }
    return Array.from(formats);
  }

  private getOoredooPhoneFormats(phone: string): string[] {
    const cleanPhone = phone.replace(/[^\d]/g, '');
    const formats = new Set<string>();
    let baseNumber = '';
    if(cleanPhone.startsWith('213')) baseNumber = cleanPhone;
    else if (cleanPhone.startsWith('0')) baseNumber = `213${cleanPhone.substring(1)}`;
    else if (cleanPhone.length === 9) baseNumber = `213${cleanPhone}`;
    if(baseNumber) {
        formats.add(baseNumber);
        formats.add(`+${baseNumber}`);
    }
    return Array.from(formats);
  }

  private isSuccessResponse(response: any): boolean {
    // Log the actual response for debugging
    this.logger.log(`Evaluating SMS response: ${JSON.stringify(response)}`);
    this.logger.log(`Response type: ${typeof response}`);
    
    // Handle empty or null responses
    if (response === null || response === undefined) {
      this.logger.warn('Received null/undefined response from SMS gateway');
      return false;
    }

    // Handle string responses
    if (typeof response === 'string') {
      const trimmed = response.trim();
      const lowerCaseResponse = trimmed.toLowerCase();
      
      // Empty string is usually an error
      if (trimmed === '') {
        this.logger.warn('Received empty string response from SMS gateway');
        return false;
      }
      
      // Common success indicators
      const successIndicators = [
        'ok', 'success', 'accepted', 'sent', 'delivered', 'queued', 
        'submitted', 'processed', 'complete', 'done'
      ];
      
      // Check for success indicators
      for (const indicator of successIndicators) {
        if (lowerCaseResponse.includes(indicator)) {
          this.logger.log(`Success indicator found: "${indicator}"`);
          return true;
        }
      }
      
      // Check if it's a numeric message ID (common for SMS gateways)
      if (/^\d+$/.test(trimmed) && parseInt(trimmed) > 0) {
        this.logger.log(`Numeric message ID received: ${trimmed}`);
        return true;
      }
      
      // Check for message ID patterns like "ID:12345" or "MSG_ID:67890"
      if (/^(id|msg_id|message_id|ref):\d+$/i.test(trimmed)) {
        this.logger.log(`Message ID pattern found: ${trimmed}`);
        return true;
      }
      
      // Common error indicators to explicitly fail
      const errorIndicators = [
        'error', 'fail', 'reject', 'invalid', 'unauthorized', 
        'forbidden', 'denied', 'blocked', 'timeout'
      ];
      
      for (const errorIndicator of errorIndicators) {
        if (lowerCaseResponse.includes(errorIndicator)) {
          this.logger.warn(`Error indicator found: "${errorIndicator}"`);
          return false;
        }
      }
      
      // If none of the above, log it for manual review
      this.logger.warn(`Ambiguous string response: "${trimmed}"`);
      // For now, assume it's a success if it's not empty and doesn't contain error indicators
      return trimmed.length > 0;
    }
    
    // Handle object responses
    if (typeof response === 'object' && response !== null) {
      // Check for explicit success indicators
      if (response.status === 'OK' || response.status === 'ok' || 
          response.success === true || response.result === 'success' ||
          response.error === false || response.sent === true) {
        this.logger.log('Object response indicates success');
        return true;
      }
      
      // Check for HTTP status codes
      if (response.code && response.code >= 200 && response.code < 300) {
        this.logger.log(`HTTP success status code: ${response.code}`);
        return true;
      }
      
      // Check for message ID in object
      if (response.id || response.messageId || response.message_id || response.ref) {
        this.logger.log('Message ID found in object response');
        return true;
      }
      
      // Check for explicit error indicators
      if (response.error === true || response.status === 'error' || 
          response.success === false || response.failed === true) {
        this.logger.warn('Object response indicates error');
        return false;
      }
      
      // If it's an object with data but no clear success/error indicators
      this.logger.warn(`Ambiguous object response: ${JSON.stringify(response)}`);
      return Object.keys(response).length > 0; // Assume success if object has data
    }
    
    // Handle numeric responses
    if (typeof response === 'number') {
      if (response > 0) {
        this.logger.log(`Numeric response (likely message ID): ${response}`);
        return true;
      } else {
        this.logger.warn(`Zero or negative numeric response: ${response}`);
        return false;
      }
    }
    
    // Handle boolean responses
    if (typeof response === 'boolean') {
      this.logger.log(`Boolean response: ${response}`);
      return response;
    }
    
    // Default case
    this.logger.warn(`Unexpected response type: ${typeof response}, value: ${response}`);
    return false;
  }
  
  private parseBalanceResponse(response: any): any {
    if (typeof response === 'string') {
        const balanceMatch = response.match(/(\d+(?:\.\d+)?)/);
        if (balanceMatch) return { balance: parseFloat(balanceMatch[1]), currency: 'DZD', source: 'string_parsing' };
    }
    if (typeof response === 'object' && response !== null) {
        const balanceFields = ['balance', 'credits', 'solde', 'amount', 'credit'];
        for (const field of balanceFields) {
            if (response[field] !== undefined) return { balance: parseFloat(response[field]), currency: response.currency || 'DZD', source: `field_${field}` };
        }
    }
    return { balance: 'unknown', currency: 'unknown', source: 'unparsable', raw: response };
  }

  private getMissingConfigVars(): string[] {
    const requiredVars = ['NETBEOPEN_API_URL', 'NETBEOPEN_WEBSERVICES_USERNAME', 'NETBEOPEN_WEBSERVICES_TOKEN', 'NETBEOPEN_SENDER_ID'];
    return requiredVars.filter(v => !process.env[v]);
  }

  private hasAllConfigVariables(): boolean {
    return this.getMissingConfigVars().length === 0;
  }

  private getMockDeliveryTime(carrier: string): string {
    const times = { 'Djezzy': '2-3 minutes', 'Mobilis': '30 seconds - 1 minute', 'Ooredoo': '1-2 minutes' };
    return times[carrier] || '1-2 minutes';
  }

  private getCarrierSpecificTips(carrier: string): string[] {
    const tips = {
      'Djezzy': ['May have delays during peak hours', 'Best to retry after 2-3 minutes if not received'],
      'Mobilis': ['Generally most reliable carrier', 'Fastest delivery times'],
      'Ooredoo': ['May filter promotional messages', 'Check spam folder if not received']
    };
    return tips[carrier] || ['Standard SMS delivery expected'];
  }
}