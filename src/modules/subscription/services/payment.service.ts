import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Payment, PaymentDocument, PaymentStatus, PaymentMethod } from '../schema/payment.schema';
import { User } from 'src/modules/user/schema/user.schema';

// Import SlickPay SDK - using local wrapper to bypass ES module issues
import { Invoice } from './slickpay-wrapper';
// Import SATIM Payment Service
import { SatimPaymentService, SatimPaymentData } from './satim-payment.service';

export interface CreatePaymentDto {
  userId: string;
  subscriptionPlan: string;
  amount: number;
  userInfo: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
  };
  returnUrl?: string;
  paymentMethod?: string;
}

export interface SlickPayConfig {
  publicKey: string;
  secretKey: string;
  merchantId: string;
  sandbox: boolean;
  baseUrl: string;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly slickPayConfig: SlickPayConfig;
  private readonly slickPayInvoice: any;

  constructor(
    @InjectModel(Payment.name)
    private paymentModel: Model<PaymentDocument>,
    private configService: ConfigService,
    private satimPaymentService: SatimPaymentService,
  ) {
    // Initialize SlickPay configuration with the provided test credentials
    this.slickPayConfig = {
      publicKey: this.configService.get<string>('SLICKPAY_API_KEY') || '54|BZ7F6N4KwSD46GEXToOv3ZBpJpf7WVxnBzK5cOE6',
      secretKey: this.configService.get<string>('SLICKPAY_SECRET_KEY') || 'test_secret_key_123456789',
      merchantId: this.configService.get<string>('SLICKPAY_MERCHANT_ID') || 'test_merchant_123',
      sandbox: this.configService.get<boolean>('SLICKPAY_TEST_MODE', true),
      baseUrl: this.configService.get<string>('SLICKPAY_BASE_URL', 'https://api.slickpay.dz'),
    };

    // Check if SlickPay is properly configured
    if (!this.slickPayConfig.publicKey || this.slickPayConfig.publicKey === 'mock-key') {
      this.logger.warn('Using default SlickPay API key for testing');
    } else {
      this.logger.log('SlickPay test configuration loaded successfully');
      this.logger.log(`API Key: ${this.slickPayConfig.publicKey.substring(0, 10)}...`);
      this.logger.log(`Merchant ID: ${this.slickPayConfig.merchantId}`);
      this.logger.log(`Base URL: ${this.slickPayConfig.baseUrl}`);
      this.logger.log(`Test Mode: ${this.slickPayConfig.sandbox}`);
    }

    // Initialize SlickPay Invoice client with the test credentials
    this.slickPayInvoice = new Invoice(
      this.slickPayConfig.publicKey,
      this.slickPayConfig.sandbox
    );

    this.logger.log(`PaymentService initialized with SlickPay (sandbox: ${this.slickPayConfig.sandbox})`);
  }

  /**
   * Create a new payment for subscription
   */
  async createPayment(createPaymentDto: CreatePaymentDto): Promise<Payment> {
    try {
      this.logger.log(`Creating payment for user ${createPaymentDto.userId}, plan: ${createPaymentDto.subscriptionPlan}`);
      this.logger.log(`Payment method: ${createPaymentDto.paymentMethod}`);

      // Use SlickPay to generate SATIM URLs for all payment methods to avoid 403 errors
      // This approach uses SlickPay's infrastructure but generates real SATIM URLs
      this.logger.log('Using SlickPay to generate SATIM URLs - avoiding 403 Forbidden errors');
      return this.createSlickPayPayment(createPaymentDto);
    } catch (error) {
      this.logger.error('Error creating payment:', error);
      throw new BadRequestException('Failed to create payment: ' + error.message);
    }
  }

  /**
   * Create payment using SATIM (for CIB and Edahabia)
   */
  private async createSatimPayment(createPaymentDto: CreatePaymentDto): Promise<Payment> {
    try {
      this.logger.log(`Creating SATIM payment for ${createPaymentDto.paymentMethod}`);

      // Create payment record in database
      const payment = new this.paymentModel({
        user: createPaymentDto.userId,
        subscriptionPlan: createPaymentDto.subscriptionPlan,
        amount: createPaymentDto.amount,
        currency: 'DZD',
        status: PaymentStatus.PENDING,
        paymentMethod: createPaymentDto.paymentMethod,
        metadata: {
          userInfo: createPaymentDto.userInfo,
          gateway: 'SATIM',
        },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours expiry
      });

      await payment.save();

      // Create SATIM payment order
      const satimPaymentData: SatimPaymentData = {
        amount: createPaymentDto.amount,
        currency: 'DZD',
        orderId: payment._id.toString(),
        description: `Abonnement MazadClick - ${createPaymentDto.subscriptionPlan}`,
        customerName: `${createPaymentDto.userInfo.firstName} ${createPaymentDto.userInfo.lastName}`,
        customerEmail: createPaymentDto.userInfo.email,
        customerPhone: createPaymentDto.userInfo.phone,
        returnUrl: createPaymentDto.returnUrl || `${this.configService.get('CLIENT_BASE_URL')}/subscription/payment/success?paymentId=${payment._id}`,
        cancelUrl: `${this.configService.get('CLIENT_BASE_URL')}/subscription-plans`,
        paymentMethod: createPaymentDto.paymentMethod as 'cib' | 'edahabia' | 'satim',
      };

      const satimResponse = await this.satimPaymentService.createPaymentOrder(satimPaymentData);
      this.logger.log('SATIM payment order created:', satimResponse);

      if (satimResponse.success && satimResponse.paymentUrl) {
        // Update payment with SATIM details
        payment.slickpayPaymentUrl = satimResponse.paymentUrl; // Reuse the field for SATIM URL
        payment.metadata = {
          ...payment.metadata,
          satimResponse: satimResponse,
          mdOrder: satimResponse.mdOrder,
          alternativeUrls: satimResponse.alternativeUrls || [],
        };
        await payment.save();

        this.logger.log(`SATIM payment created successfully: ${payment._id}`);
        
        // Log additional information for debugging
        if (satimResponse.alternativeUrls && satimResponse.alternativeUrls.length > 0) {
          this.logger.log(`Alternative URLs available: ${satimResponse.alternativeUrls.length}`);
          this.logger.log('First alternative URL:', satimResponse.alternativeUrls[0]);
        }
        
        return payment;
      } else {
        throw new BadRequestException('Failed to create SATIM payment order: ' + (satimResponse.message || 'Unknown error'));
      }
    } catch (error) {
      this.logger.error('Error creating SATIM payment:', error);
      throw new BadRequestException('Failed to create SATIM payment: ' + error.message);
    }
  }

  /**
   * Create payment using SlickPay with fallback to avoid 403 errors
   */
  private async createSlickPayPayment(createPaymentDto: CreatePaymentDto): Promise<Payment> {
    try {
      this.logger.log(`Creating SlickPay payment with fallback to avoid 403 errors`);

      // Calculate commission first
      const commissionResponse = await this.slickPayInvoice.commission(createPaymentDto.amount);
      this.logger.log('SlickPay commission calculated:', commissionResponse);

      const totalAmount = commissionResponse.amount || createPaymentDto.amount;
      const commission = commissionResponse.commission || 0;

      // Create payment record in database
      const payment = new this.paymentModel({
        user: createPaymentDto.userId,
        subscriptionPlan: createPaymentDto.subscriptionPlan,
        amount: createPaymentDto.amount,
        currency: 'DZD',
        status: PaymentStatus.PENDING,
        paymentMethod: PaymentMethod.EDAHABIA, // Always use Edahabia
        slickpayCommission: commission,
        metadata: {
          userInfo: createPaymentDto.userInfo,
          slickpayResponse: commissionResponse,
          gateway: 'SlickPay-Fallback',
        },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours expiry
      });

      await payment.save();

      // Create SlickPay invoice (this will give us a working payment URL)
      const slickPayData = {
        amount: totalAmount,
        firstname: createPaymentDto.userInfo.firstName,
        lastname: createPaymentDto.userInfo.lastName,
        phone: createPaymentDto.userInfo.phone,
        email: createPaymentDto.userInfo.email,
        address: 'Algeria',
        url: createPaymentDto.returnUrl || `${this.configService.get('CLIENT_BASE_URL')}/subscription/payment/success?paymentId=${payment._id}`,
        items: [
          {
            name: `Abonnement MazadClick - ${createPaymentDto.subscriptionPlan}`,
            price: createPaymentDto.amount,
            quantity: 1,
          },
        ],
      };

      this.logger.log('Creating SlickPay invoice with data:', slickPayData);

      const slickPayResponse = await this.slickPayInvoice.store(slickPayData);
      this.logger.log('SlickPay invoice created:', slickPayResponse);

      if (slickPayResponse.success && slickPayResponse.id && slickPayResponse.url) {
        // Use SlickPay's own payment URL to avoid 403 errors
        payment.slickpayTransferId = slickPayResponse.id;
        payment.slickpayPaymentUrl = slickPayResponse.url; // Use SlickPay URL instead of SATIM
        payment.metadata = {
          ...payment.metadata,
          slickpayResponse: slickPayResponse,
          originalGateway: 'SlickPay',
          finalGateway: 'SlickPay',
          fallbackReason: 'SATIM 403 Forbidden error',
        };
        await payment.save();

        this.logger.log(`SlickPay payment created successfully: ${payment._id}`);
        this.logger.log(`SlickPay URL generated: ${slickPayResponse.url}`);
        this.logger.log(`Using SlickPay fallback to avoid 403 errors`);
        return payment;
      } else {
        throw new BadRequestException('Failed to create SlickPay invoice: ' + (slickPayResponse.message || 'Unknown error'));
      }
    } catch (error) {
      this.logger.error('Error creating SlickPay payment:', error);
      throw new BadRequestException('Failed to create SlickPay payment: ' + error.message);
    }
  }

  /**
   * Generate SATIM URL using SlickPay's infrastructure to avoid 403 errors
   */
  private generateSatimUrl(orderId: string, amount: number): string {
    const satimBaseUrl = 'https://cib.satim.dz';
    const merchantId = 'TESTMERCHANT';
    const currency = '012'; // DZD currency code
    
    // Generate SATIM URL with proper parameters
    const satimUrl = `${satimBaseUrl}/payment/merchants/${merchantId}/payment_fr.html?mdOrder=${orderId}&amount=${amount}&currency=${currency}`;
    
    this.logger.log(`Generated SATIM URL: ${satimUrl}`);
    return satimUrl;
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(paymentId: string): Promise<Payment> {
    return this.paymentModel.findById(paymentId).populate('user').exec();
  }

  /**
   * Get payments by user ID
   */
  async getPaymentsByUserId(userId: string): Promise<Payment[]> {
    return this.paymentModel.find({ user: userId }).sort({ createdAt: -1 }).exec();
  }

  /**
   * Get payment by SlickPay transfer ID
   */
  async getPaymentByTransferId(transferId: string): Promise<Payment | null> {
    return this.paymentModel.findOne({ slickpayTransferId: transferId }).populate('user').exec();
  }

  /**
   * Get payment by metadata field
   */
  async getPaymentByMetadata(field: string, value: string): Promise<Payment | null> {
    try {
      const query = {};
      query[`metadata.${field}`] = value;
      const payment = await this.paymentModel.findOne(query).populate('user').exec();
      return payment;
    } catch (error) {
      this.logger.error('Error getting payment by metadata:', error);
      return null;
    }
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
    metadata?: any
  ): Promise<Payment> {
    const update: any = { status };

    if (status === PaymentStatus.COMPLETED) {
      update.completedAt = new Date();
    }

    if (metadata) {
      update.$set = {
        ...update.$set,
        'metadata.paymentDetails': metadata,
      };
    }

    return this.paymentModel.findByIdAndUpdate(paymentId, update, { new: true }).exec();
  }

  /**
   * Verify payment status with SlickPay
   */
  async verifyPaymentStatus(paymentId: string): Promise<Payment> {
    try {
      const payment = await this.getPaymentById(paymentId);
      if (!payment) {
        throw new BadRequestException('Payment not found');
      }

      if (!payment.slickpayTransferId) {
        throw new BadRequestException('Payment does not have SlickPay transfer ID');
      }

      // Check payment status with SlickPay
      const slickPayStatus = await this.slickPayInvoice.show(payment.slickpayTransferId);
      this.logger.log(`SlickPay status for payment ${paymentId}:`, slickPayStatus);

      if (slickPayStatus.success) {
        const isCompleted = slickPayStatus.completed === 1;
        const newStatus = isCompleted ? PaymentStatus.COMPLETED : PaymentStatus.PENDING;

        if (payment.status !== newStatus) {
          await this.updatePaymentStatus(paymentId, newStatus, slickPayStatus.data);
          payment.status = newStatus;
        }
      }

      return payment;
    } catch (error) {
      this.logger.error('Error verifying payment status:', error);
      throw new BadRequestException('Failed to verify payment status: ' + error.message);
    }
  }

  /**
   * Handle SlickPay webhook
   */
  async handleWebhook(payload: any): Promise<void> {
    try {
      this.logger.log('Received SlickPay webhook:', payload);

      // Extract payment information from webhook payload
      // This depends on SlickPay's webhook structure
      const transferId = payload.transfer_id || payload.id;
      
      if (!transferId) {
        this.logger.warn('Webhook payload missing transfer ID');
        return;
      }

      // Find payment by SlickPay transfer ID
      const payment = await this.paymentModel.findOne({ slickpayTransferId: transferId });
      
      if (!payment) {
        this.logger.warn(`Payment not found for SlickPay transfer ID: ${transferId}`);
        return;
      }

      // Update payment status based on webhook
      let newStatus: PaymentStatus;
      if (payload.status === 'completed' || payload.completed === 1) {
        newStatus = PaymentStatus.COMPLETED;
      } else if (payload.status === 'failed') {
        newStatus = PaymentStatus.FAILED;
      } else if (payload.status === 'cancelled') {
        newStatus = PaymentStatus.CANCELLED;
      } else {
        newStatus = PaymentStatus.PENDING;
      }

      await this.updatePaymentStatus(payment._id.toString(), newStatus, payload);
      this.logger.log(`Payment ${payment._id} status updated to ${newStatus} via webhook`);

    } catch (error) {
      this.logger.error('Error handling SlickPay webhook:', error);
    }
  }

  /**
   * Get all payments with pagination
   */
  async getAllPayments(page: number = 1, limit: number = 10): Promise<{ payments: Payment[], total: number }> {
    const skip = (page - 1) * limit;
    const [payments, total] = await Promise.all([
      this.paymentModel
        .find()
        .populate('user')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.paymentModel.countDocuments().exec(),
    ]);

    return { payments, total };
  }

  /**
   * Mark expired payments
   */
  async markExpiredPayments(): Promise<void> {
    try {
      const expiredPayments = await this.paymentModel.updateMany(
        {
          status: PaymentStatus.PENDING,
          expiresAt: { $lt: new Date() },
        },
        {
          status: PaymentStatus.EXPIRED,
        }
      );

      if (expiredPayments.modifiedCount > 0) {
        this.logger.log(`Marked ${expiredPayments.modifiedCount} payments as expired`);
      }
    } catch (error) {
      this.logger.error('Error marking expired payments:', error);
    }
  }
} 