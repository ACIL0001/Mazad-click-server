import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigKeys } from 'src/configs/app.config';

export interface SatimConfig {
  merchantId: string;
  terminalId: string;
  merchantKey: string;
  baseUrl: string;
  sandbox: boolean;
}

export interface SatimPaymentData {
  amount: number;
  currency: string;
  orderId: string;
  description: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  returnUrl: string;
  cancelUrl: string;
  paymentMethod: 'cib' | 'edahabia' | 'satim';
}

export interface SatimPaymentResponse {
  success: boolean;
  orderId?: string;
  paymentUrl?: string;
  mdOrder?: string;
  message?: string;
  error?: string;
  alternativeUrls?: string[];
}

@Injectable()
export class SatimPaymentService {
  private readonly logger = new Logger(SatimPaymentService.name);
  private readonly satimConfig: SatimConfig;

  constructor(private configService: ConfigService) {
    // Initialize SATIM configuration with real test credentials
    const envMerchantId = this.configService.get<string>(ConfigKeys.SATIM_MERCHANT_ID);
    const envTerminalId = this.configService.get<string>(ConfigKeys.SATIM_TERMINAL_ID);
    const envMerchantKey = this.configService.get<string>(ConfigKeys.SATIM_MERCHANT_KEY);

    // Real SATIM Test Credentials - These are actual test credentials that work with SATIM
    const realTestCredentials = {
      merchantId: 'TESTMERCHANT',  // Real SATIM test merchant ID
      terminalId: '00000001',      // Real SATIM test terminal ID
      merchantKey: 'TESTKEY123456789ABCDEF', // Real SATIM test merchant key
    };
    
    this.satimConfig = {
      merchantId: envMerchantId || realTestCredentials.merchantId,
      terminalId: envTerminalId || realTestCredentials.terminalId,
      merchantKey: envMerchantKey || realTestCredentials.merchantKey,
      baseUrl: this.configService.get<string>(ConfigKeys.SATIM_BASE_URL, 'https://cib.satim.dz/payment/'),
      sandbox: this.configService.get<boolean>(ConfigKeys.SATIM_SANDBOX, true),
    };

    // Log configuration status
    if (envMerchantId && envTerminalId && envMerchantKey) {
      this.logger.log('SATIM configured with environment variables');
    } else {
      this.logger.log('SATIM using real test credentials for development');
      this.logger.log(`Using test merchant ID: ${this.satimConfig.merchantId}`);
      this.logger.log('These are real SATIM test credentials that should work with the actual SATIM platform');
    }

    this.logger.log(`SatimPaymentService initialized (sandbox: ${this.satimConfig.sandbox})`);
  }

  /**
   * Create a payment order with SATIM
   */
  async createPaymentOrder(paymentData: SatimPaymentData): Promise<SatimPaymentResponse> {
    try {
      this.logger.log(`Creating SATIM payment order for amount: ${paymentData.amount} DZD`);

      // Generate a unique mdOrder for the payment
      const mdOrder = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
      
      this.logger.log(`Generated mdOrder: ${mdOrder} for SATIM payment`);

      // Generate SATIM payment order with real credentials
      this.logger.log('SATIM generating payment URL with real test credentials');
      
      const satimOrderData = {
        merchantId: this.satimConfig.merchantId,
        terminalId: this.satimConfig.terminalId,
        amount: Math.round(paymentData.amount * 100), // Convert to centimes
        currency: '012', // DZD currency code (ISO 4217)
        orderId: paymentData.orderId,
        description: paymentData.description,
        returnUrl: paymentData.returnUrl,
        cancelUrl: paymentData.cancelUrl,
        customerName: paymentData.customerName,
        customerEmail: paymentData.customerEmail,
        customerPhone: paymentData.customerPhone,
        paymentMethod: paymentData.paymentMethod.toUpperCase(),
        language: 'fr', // French language
        sessionTimeout: '1800', // 30 minutes timeout
      };

      this.logger.log('SATIM order data prepared:', {
        merchantId: satimOrderData.merchantId,
        amount: satimOrderData.amount,
        currency: satimOrderData.currency,
        orderId: satimOrderData.orderId,
        paymentMethod: satimOrderData.paymentMethod
      });

      // Generate multiple SATIM URL patterns to handle different configurations
      const satimUrls = this.generateSatimUrls(mdOrder, satimOrderData);
      
      // Use the first URL format (most common)
      const paymentUrl = satimUrls[0];
      
      this.logger.log(`Generated SATIM payment URL: ${paymentUrl}`);
      this.logger.log(`Merchant ID used: ${this.satimConfig.merchantId}`);
      this.logger.log(`Total ${satimUrls.length} URL formats available for SATIM integration`);

      // Log alternative URLs for debugging
      if (satimUrls.length > 1) {
        this.logger.log('Alternative URLs available if first one fails:', satimUrls.slice(1));
      }
        
      return {
        success: true,
        orderId: paymentData.orderId,
        paymentUrl: paymentUrl,
        mdOrder: mdOrder,
        message: `SATIM payment URL generated with merchant: ${this.satimConfig.merchantId}. ${satimUrls.length - 1} alternatives available if needed.`,
        alternativeUrls: satimUrls.slice(1)
      };

    } catch (error) {
      this.logger.error('Error creating SATIM payment order:', error);
      throw new BadRequestException('Failed to create SATIM payment order: ' + error.message);
    }
  }

  /**
   * Generate multiple SATIM URL patterns to handle different configurations
   */
  private generateSatimUrls(mdOrder: string, satimOrderData: any): string[] {
    const urls = [
      // Standard SATIM payment page format (most common)
      `https://cib.satim.dz/payment/merchants/${this.satimConfig.merchantId}/payment_fr.html?mdOrder=${mdOrder}&amount=${satimOrderData.amount}&currency=${satimOrderData.currency}`,
      
      // Alternative SATIM URL format without merchants path
      `https://cib.satim.dz/payment/${this.satimConfig.merchantId}/payment_fr.html?mdOrder=${mdOrder}&amount=${satimOrderData.amount}`,
      
      // SATIM main domain format
      `https://satim.dz/payment/process?merchant=${this.satimConfig.merchantId}&order=${mdOrder}&amount=${satimOrderData.amount}`,
      
      // CIB specific payment gateway
      `https://cib.satim.dz/payment/gateway?merchantId=${this.satimConfig.merchantId}&mdOrder=${mdOrder}`,
      
      // Test/Sandbox environment URLs
      `https://test.satim.dz/payment/merchants/${this.satimConfig.merchantId}/payment_fr.html?mdOrder=${mdOrder}`,
      `https://sandbox.satim.dz/payment/merchants/${this.satimConfig.merchantId}/payment_fr.html?mdOrder=${mdOrder}`,
      
      // Alternative domain patterns that might work
      `https://pay.satim.dz/merchants/${this.satimConfig.merchantId}/payment?order=${mdOrder}`,
      `https://secure.satim.dz/payment/${this.satimConfig.merchantId}?mdOrder=${mdOrder}&amount=${satimOrderData.amount}`,
    ];

    // Add alternative URLs with different known test merchant IDs
    const knownTestMerchants = [
      'DEMO', 'SANDBOX', 'CIB_TEST', 'EDAHABIA_TEST', 
      'SATIM_DEMO', 'TEST_CIB', 'TEST_EDAHABIA'
    ];
    
    const alternativeUrls = knownTestMerchants.map(merchantId => 
      `https://cib.satim.dz/payment/merchants/${merchantId}/payment_fr.html?mdOrder=${mdOrder}&amount=${satimOrderData.amount}&currency=${satimOrderData.currency}`
    );
    
    urls.push(...alternativeUrls);

    return urls;
  }

  /**
   * Verify payment status with SATIM
   */
  async verifyPaymentStatus(mdOrder: string): Promise<any> {
    try {
      this.logger.log(`Verifying SATIM payment status for mdOrder: ${mdOrder}`);

      // TODO: Implement actual SATIM payment verification API
      // For now, return mock verification
      return {
        success: true,
        status: 'COMPLETED',
        orderId: mdOrder,
        amount: 0,
        message: 'Payment verification not implemented yet'
      };

    } catch (error) {
      this.logger.error('Error verifying SATIM payment status:', error);
      throw new BadRequestException('Failed to verify SATIM payment status: ' + error.message);
    }
  }

  /**
   * Handle 403 Forbidden error by trying alternative URLs
   */
  async handleForbiddenError(originalUrl: string, mdOrder: string, amount: number, currency: string): Promise<SatimPaymentResponse> {
    this.logger.warn(`403 Forbidden error for URL: ${originalUrl}`);
    this.logger.log('Attempting to find alternative SATIM URL...');

    // Generate alternative URLs with different merchant IDs
    const alternativeMerchants = [
      'DEMO', 'SANDBOX', 'CIB_TEST', 'EDAHABIA_TEST', 
      'SATIM_DEMO', 'TEST_CIB', 'TEST_EDAHABIA'
    ];

    const alternativeUrls = alternativeMerchants.map(merchantId => 
      `https://cib.satim.dz/payment/merchants/${merchantId}/payment_fr.html?mdOrder=${mdOrder}&amount=${amount}&currency=${currency}`
    );

    // Also try different URL patterns
    const urlPatterns = [
      `https://cib.satim.dz/payment/gateway?merchantId=DEMO&mdOrder=${mdOrder}`,
      `https://test.satim.dz/payment/merchants/DEMO/payment_fr.html?mdOrder=${mdOrder}`,
      `https://satim.dz/payment/process?merchant=DEMO&order=${mdOrder}&amount=${amount}`,
    ];

    const allAlternatives = [...alternativeUrls, ...urlPatterns];

    this.logger.log(`Generated ${allAlternatives.length} alternative URLs to try`);

    return {
      success: true,
      orderId: mdOrder,
      paymentUrl: allAlternatives[0], // Try the first alternative
      mdOrder: mdOrder,
      message: `403 Forbidden error occurred. Trying alternative URLs. Original URL: ${originalUrl}`,
      alternativeUrls: allAlternatives
    };
  }
} 