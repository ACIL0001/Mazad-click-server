import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  BadRequestException,
  Query,
  Res,
} from '@nestjs/common';
import { SubscriptionService, CreateSubscriptionDto } from './subscription.service';
import { PaymentService } from './services/payment.service';
import { Subscription } from './schema/subscription.schema';
import { Payment, PaymentStatus } from './schema/payment.schema';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { ProtectedRequest } from 'src/types/request.type';
import { AdminGuard } from 'src/common/guards/admin.guard';
import { Public } from 'src/common/decorators/public.decorator';
import { ConfigService } from '@nestjs/config';

@Controller('subscription')
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly paymentService: PaymentService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @UseGuards(AdminGuard)
  findAll() {
    return this.subscriptionService.findAll();
  }

  @Get('plans')
  @Public()
  async getPlans() {
    return this.subscriptionService.findAllPlans();
  }

  @Get('plans/:role')
  @Public()
  async getPlansByRole(@Param('role') role: string) {
    const plans = await this.subscriptionService.findPlansByRole(role);
    return {
      success: true,
      plans,
    };
  }

  @Post('create-with-payment')
  @UseGuards(AuthGuard)
  async createSubscriptionWithPayment(
    @Request() req: ProtectedRequest,
    @Body() body: { plan: string; returnUrl?: string; paymentMethod?: string }
  ) {
    try {
      const user = req.session.user;
      
      if (!body.plan) {
        throw new BadRequestException('Subscription plan is required');
      }

      const createSubscriptionDto: CreateSubscriptionDto = {
        userId: user._id.toString(),
        planId: body.plan,
        paymentData: {
          userInfo: {
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            email: user.email || '',
          },
          returnUrl: body.returnUrl,
          paymentMethod: body.paymentMethod,
        },
      };

      const result = await this.subscriptionService.createSubscriptionWithPayment(createSubscriptionDto);
      
      return {
        success: true,
        message: 'Subscription created successfully. Proceed to payment.',
        subscription: result.subscription,
        payment: {
          id: result.payment._id,
          amount: result.payment.amount,
          currency: result.payment.currency,
          status: result.payment.status,
          paymentUrl: result.payment.slickpayPaymentUrl,
          expiresAt: result.payment.expiresAt,
        },
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('payment/:paymentId/status')
  @UseGuards(AuthGuard)
  async getPaymentStatus(
    @Request() req: ProtectedRequest,
    @Param('paymentId') paymentId: string
  ) {
    try {
      const payment = await this.paymentService.verifyPaymentStatus(paymentId);
      
      // Ensure user can only access their own payments
      if (payment.user._id.toString() !== req.session.user._id.toString()) {
        throw new BadRequestException('Unauthorized access to payment');
      }

      return {
        success: true,
        payment: {
          id: payment._id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          subscriptionPlan: payment.subscriptionPlan,
          completedAt: payment.completedAt,
          expiresAt: payment.expiresAt,
        },
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('payment/:paymentId/confirm')
  @UseGuards(AuthGuard)
  async confirmPayment(
    @Request() req: ProtectedRequest,
    @Param('paymentId') paymentId: string
  ) {
    try {
      const payment = await this.paymentService.getPaymentById(paymentId);
      
      // Ensure user can only confirm their own payments
      if (payment.user._id.toString() !== req.session.user._id.toString()) {
        throw new BadRequestException('Unauthorized access to payment');
      }

      const result = await this.subscriptionService.confirmSubscriptionPayment(paymentId);
      
      return {
        success: true,
        message: 'Payment confirmed and subscription activated successfully',
        subscription: result.subscription,
        payment: result.payment,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('my-subscription')
  @Public()
  async getMySubscription(@Request() req: ProtectedRequest) {
    try {
      // Check if user is authenticated
      if (!req.session?.user?._id) {
        return {
          success: false,
          message: 'No authenticated user found',
          subscription: null,
          hasActiveSubscription: false,
          allSubscriptions: []
        };
      }

      const userId = req.session.user._id.toString();
      const activeSubscription = await this.subscriptionService.findActiveSubscriptionByUserId(userId);
      const allSubscriptions = await this.subscriptionService.findAllSubscriptionsByUserId(userId);
      
      return {
        success: true,
        subscription: activeSubscription,
        hasActiveSubscription: !!activeSubscription,
        allSubscriptions: allSubscriptions.map(sub => ({
          id: sub._id,
          planId: sub.plan._id,
          planName: sub.plan.name,
          expiresAt: sub.expiresAt,
          isActive: sub.expiresAt > new Date(),
          createdAt: sub.createdAt
        }))
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('my-payments')
  @UseGuards(AuthGuard)
  async getMyPayments(@Request() req: ProtectedRequest) {
    const userId = req.session.user._id.toString();
    const payments = await this.paymentService.getPaymentsByUserId(userId);
    
    return {
      success: true,
      payments: payments.map(payment => ({
        id: payment._id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        subscriptionPlan: payment.subscriptionPlan,
        createdAt: payment.createdAt,
        completedAt: payment.completedAt,
        expiresAt: payment.expiresAt,
      })),
    };
  }

  @Post('webhook/slickpay')
  @Public()
  async handleSlickPayWebhook(@Body() payload: any) {
    try {
      await this.paymentService.handleWebhook(payload);
      return { success: true };
    } catch (error) {
      console.error('Webhook error:', error);
      return { success: false, error: error.message };
    }
  }

  // --- NEW ADMIN ROUTES ---
  @Post('admin/plans')
  @UseGuards(AdminGuard)
  async createPlan(@Body() body: any) {
    return this.subscriptionService.createPlan(body);
  }

  @Patch('admin/plans/:planId')
  @UseGuards(AdminGuard)
  async updatePlan(@Param('planId') planId: string, @Body() body: any) {
    return this.subscriptionService.updatePlan(planId, body);
  }

  @Delete('admin/plans/:planId')
  @UseGuards(AdminGuard)
  async deletePlan(@Param('planId') planId: string) {
    await this.subscriptionService.deletePlan(planId);
    return { success: true, message: 'Plan deleted successfully' };
  }

  @Post('admin/init-plans')
  @UseGuards(AdminGuard)
  async initializePlans() {
    await this.subscriptionService.createDefaultPlans();
    return { success: true, message: 'Default plans initialized' };
  }

  @Get('admin/stats')
  @UseGuards(AdminGuard)
  async getStats() {
    // You would implement the logic to get stats in the service
    // For now, let's return a simple mock object as the logic is not in the service
    return {
      success: true,
      stats: {
        totalSubscriptions: 0,
        activeSubscriptions: 0,
        monthlyRevenue: 0,
      }
    };
  }

  @Get('admin/payments')
@UseGuards(AdminGuard)
async getAllPayments(@Query('page') page: number = 1, @Query('limit') limit: number = 10) {
  // Corrected line: Changed findAllPayments to getAllPayments
  const payments = await this.paymentService.getAllPayments(page, limit);
  return {
    success: true,
    payments,
  };
  }
  // --- END OF NEW ADMIN ROUTES ---

  // Mock SATIM payment form for development/testing
  @Get('payment/mock-satim-form/:mdOrder')
  @Public()
  async showMockSatimForm(@Param('mdOrder') mdOrder: string, @Res() res: any) {
    try {
      console.log(`🎯 Mock SATIM form accessed for mdOrder: ${mdOrder}`);
      
      const satimFormHtml = `
        <html>
          <head>
            <title>Mock SATIM Payment Gateway</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                margin: 0; 
                padding: 50px;
                min-height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
              }
              .payment-container { 
                background: white; 
                padding: 40px; 
                border-radius: 15px; 
                max-width: 500px; 
                width: 100%;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
              }
              .header { 
                text-align: center; 
                margin-bottom: 30px; 
                color: #333;
              }
              .logo { 
                font-size: 28px; 
                font-weight: bold; 
                color: #667eea; 
                margin-bottom: 10px;
              }
              .form-group { 
                margin-bottom: 20px; 
              }
              label { 
                display: block; 
                margin-bottom: 8px; 
                font-weight: 600; 
                color: #555;
              }
              input[type="text"], input[type="email"] { 
                width: 100%; 
                padding: 12px; 
                border: 2px solid #e1e5e9; 
                border-radius: 8px; 
                font-size: 16px;
                transition: border-color 0.3s;
              }
              input[type="text"]:focus, input[type="email"]:focus { 
                outline: none; 
                border-color: #667eea; 
              }
              .card-row { 
                display: flex; 
                gap: 15px; 
              }
              .card-row .form-group { 
                flex: 1; 
              }
              .button-group { 
                display: flex; 
                gap: 15px; 
                margin-top: 30px; 
              }
              .btn { 
                padding: 15px 30px; 
                border: none; 
                border-radius: 8px; 
                font-size: 16px; 
                font-weight: 600; 
                cursor: pointer; 
                transition: all 0.3s;
                flex: 1;
              }
              .btn-success { 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                color: white; 
              }
              .btn-success:hover { 
                transform: translateY(-2px); 
                box-shadow: 0 10px 20px rgba(0,0,0,0.2);
              }
              .btn-cancel { 
                background: #f8f9fa; 
                color: #6c757d; 
                border: 2px solid #e9ecef;
              }
              .btn-cancel:hover { 
                background: #e9ecef; 
              }
              .payment-methods {
                display: flex;
                gap: 10px;
                margin-bottom: 20px;
              }
              .payment-method {
                flex: 1;
                padding: 15px;
                border: 2px solid #e1e5e9;
                border-radius: 8px;
                text-align: center;
                cursor: pointer;
                transition: all 0.3s;
              }
              .payment-method.selected {
                border-color: #667eea;
                background: #f8f9ff;
              }
              .payment-method:hover {
                border-color: #667eea;
              }
              .info-box {
                background: #f8f9ff;
                border: 1px solid #e1e5e9;
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 20px;
                font-size: 14px;
                color: #666;
              }
            </style>
          </head>
          <body>
            <div class="payment-container">
              <div class="header">
                <div class="logo">🏦 SATIM Payment Gateway</div>
                <p style="color: #666; margin: 0;">Paiement sécurisé par carte bancaire</p>
              </div>

              <div class="info-box">
                <strong>🛡️ Mode Développement</strong><br>
                Ceci est une simulation de la page de paiement SATIM pour les tests.
              </div>

              <form action="/subscription/payment/mock-satim-process" method="POST">
                <input type="hidden" name="mdOrder" value="${mdOrder}">
                
                <div class="form-group">
                  <label>Méthode de paiement:</label>
                  <div class="payment-methods">
                    <div class="payment-method selected" onclick="selectPaymentMethod('cib')">
                      <strong>CIB</strong><br>
                      <small>Carte Interbancaire</small>
                    </div>
                    <div class="payment-method" onclick="selectPaymentMethod('edahabia')">
                      <strong>Edahabia</strong><br>
                      <small>Carte Edahabia</small>
                    </div>
                  </div>
                  <input type="hidden" name="paymentType" value="cib" id="paymentType">
                </div>

                <div class="form-group">
                  <label for="cardNumber">Numéro de carte *</label>
                  <input type="text" id="cardNumber" name="cardNumber" placeholder="1234 5678 9012 3456" maxlength="19" required>
                </div>

                <div class="card-row">
                  <div class="form-group">
                    <label for="expiryDate">Date d'expiration *</label>
                    <input type="text" id="expiryDate" name="expiryDate" placeholder="MM/AA" maxlength="5" required>
                  </div>
                  <div class="form-group">
                    <label for="cvv">CVV *</label>
                    <input type="text" id="cvv" name="cvv" placeholder="123" maxlength="3" required>
                  </div>
                </div>

                <div class="form-group">
                  <label for="cardName">Nom sur la carte *</label>
                  <input type="text" id="cardName" name="cardName" placeholder="MOHAMED ALAMI" required>
                </div>

                <div class="button-group">
                  <button type="button" class="btn btn-cancel" onclick="window.location.href='${this.configService.get('CLIENT_BASE_URL')}/subscription-plans'">
                    Annuler
                  </button>
                  <button type="submit" class="btn btn-success">
                    💳 Payer Maintenant
                  </button>
                </div>
              </form>
            </div>

            <script>
              function selectPaymentMethod(method) {
                document.querySelectorAll('.payment-method').forEach(el => el.classList.remove('selected'));
                event.target.closest('.payment-method').classList.add('selected');
                document.getElementById('paymentType').value = method;
              }

              // Format card number
              document.getElementById('cardNumber').addEventListener('input', function(e) {
                let value = e.target.value.replace(/\s/g, '').replace(/[^0-9]/g, '');
                let formattedValue = value.replace(/(\d{4})(?=\d)/g, '$1 ');
                if (formattedValue !== e.target.value) {
                  e.target.value = formattedValue;
                }
              });

              // Format expiry date
              document.getElementById('expiryDate').addEventListener('input', function(e) {
                let value = e.target.value.replace(/[^0-9]/g, '');
                if (value.length >= 2) {
                  value = value.substring(0, 2) + '/' + value.substring(2, 4);
                }
                e.target.value = value;
              });

              // Only numbers for CVV
              document.getElementById('cvv').addEventListener('input', function(e) {
                e.target.value = e.target.value.replace(/[^0-9]/g, '');
              });
            </script>
          </body>
        </html>
      `;
      res.setHeader('Content-Type', 'text/html');
      return res.send(satimFormHtml);
    } catch (error) {
      console.error('❌ Error showing mock SATIM form:', error);
      return res.status(500).send('Error loading payment form');
    }
  }

  // Process mock SATIM payment
  @Post('payment/mock-satim-process')
  @Public()
  async processMockSatimPayment(@Body() body: any, @Res() res: any) {
    try {
      const { mdOrder, paymentType, cardNumber, expiryDate, cvv, cardName } = body;
      console.log(`🎯 Processing mock SATIM payment for mdOrder: ${mdOrder}`);
      console.log(`Payment details: ${paymentType}, Card: ${cardNumber?.substring(0, 4)}****`);
      
      // Find payment by mdOrder
      const payment = await this.paymentService.getPaymentByMetadata('mdOrder', mdOrder);
      if (!payment) {
        console.log(`❌ Payment not found for mdOrder: ${mdOrder}`);
        return res.redirect(`${this.configService.get('CLIENT_BASE_URL')}/subscription/payment/error`);
      }

      // Simulate successful payment
      await this.paymentService.updatePaymentStatus(payment._id.toString(), PaymentStatus.COMPLETED, {
        mockSatimPayment: true,
        completedAt: new Date(),
        paymentMethod: paymentType,
        mdOrder: mdOrder,
        cardInfo: {
          lastFour: cardNumber?.substring(cardNumber.length - 4),
          cardName: cardName,
          expiryDate: expiryDate
        },
        message: 'Mock SATIM payment completed successfully'
      });

      console.log(`✅ Mock SATIM payment completed for payment: ${payment._id}`);
      
      // Redirect to success page
      return res.redirect(`${this.configService.get('CLIENT_BASE_URL')}/subscription/payment/success?paymentId=${payment._id}`);
    } catch (error) {
      console.error('❌ Error processing mock SATIM payment:', error);
      return res.redirect(`${this.configService.get('CLIENT_BASE_URL')}/subscription/payment/error`);
    }
  }

  // Mock SATIM payment routes for development/testing (legacy)
  @Get('payment/mock-satim/:paymentMethod/:mdOrder')
  @Public()
  async handleMockSatimPayment(
    @Param('paymentMethod') paymentMethod: string,
    @Param('mdOrder') mdOrder: string,
    @Res() res: any
  ) {
    try {
      console.log(`🎯 Mock SATIM payment route accessed: ${paymentMethod}/${mdOrder}`);
      
      // Find the payment by order ID (mdOrder should be the payment ID for mock payments)
      const paymentId = mdOrder.replace('MOCK', '').substring(13); // Extract payment ID from mock mdOrder
      const payment = await this.paymentService.getPaymentById(paymentId);
      if (!payment) {
        // If payment not found by extracted ID, try to find by mdOrder in metadata
        const paymentByMdOrder = await this.paymentService.getPaymentByMetadata('mdOrder', mdOrder);
        if (paymentByMdOrder) {
          return this.renderSatimMockSuccess(paymentByMdOrder, paymentMethod, mdOrder, res);
        }
        console.log(`❌ Payment not found for mdOrder: ${mdOrder}`);
        return res.status(404).send(`
          <html>
            <head><title>Mock SATIM Payment Not Found</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding-top: 50px;">
              <h2>Payment Not Found</h2>
              <p>The payment reference could not be found. Please check your URL or try again.</p>
              <a href="${this.configService.get('CLIENT_BASE_URL')}/subscription-plans">Return to Plans</a>
            </body>
          </html>
        `);
      }

      // Simulate the success flow by updating the payment status
      await this.paymentService.updatePaymentStatus(paymentId, PaymentStatus.COMPLETED, {
        message: 'Mock payment completed via redirect',
        paymentMethod: paymentMethod,
        mdOrder: mdOrder,
      });

      console.log(`✅ Mock SATIM payment completed for paymentId: ${paymentId}`);
      
      return this.renderSatimMockSuccess(payment, paymentMethod, mdOrder, res);
    } catch (error) {
      console.error('❌ Error in mock SATIM payment redirect:', error);
      return res.status(500).send(`
        <html>
          <head><title>Mock SATIM Payment Error</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding-top: 50px;">
            <h2>Payment Error</h2>
            <p>An error occurred while processing your mock payment. Please try again.</p>
            <a href="${this.configService.get('CLIENT_BASE_URL')}/subscription-plans">Return to Plans</a>
          </body>
        </html>
      `);
    }
  }

  // Helper method to render a mock success page
  private renderSatimMockSuccess(payment: Payment, paymentMethod: string, mdOrder: string, res: any) {
    const successPageHtml = `
      <html>
        <head>
          <title>Payment Successful</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              background: linear-gradient(135deg, #e0f7fa 0%, #b3e5fc 100%);
              display: flex; 
              justify-content: center; 
              align-items: center; 
              min-height: 100vh;
              color: #01579b;
              text-align: center;
            }
            .success-box {
              background-color: white;
              padding: 40px;
              border-radius: 15px;
              box-shadow: 0 10px 30px rgba(0, 88, 122, 0.15);
              border-left: 5px solid #00c853;
              max-width: 500px;
            }
            .success-icon {
              font-size: 60px;
              color: #00c853;
              margin-bottom: 20px;
            }
            h1 {
              color: #00c853;
            }
            p {
              font-size: 1.1em;
              line-height: 1.6;
            }
            .details {
              background-color: #e0f2f1;
              padding: 15px;
              border-radius: 8px;
              margin-top: 25px;
              text-align: left;
            }
            .details strong {
              color: #00796b;
            }
            .btn-return {
              display: inline-block;
              margin-top: 30px;
              padding: 12px 25px;
              background-color: #00897b;
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: bold;
              transition: background-color 0.3s;
            }
            .btn-return:hover {
              background-color: #00695c;
            }
          </style>
        </head>
        <body>
          <div class="success-box">
            <div class="success-icon">&#x2713;</div>
            <h1>Paiement Réussi !</h1>
            <p>Votre paiement a été traité avec succès. Votre abonnement est maintenant actif.</p>
            
            <div class="details">
              <strong>Détails de la transaction:</strong><br>
              ID de paiement: ${payment._id}<br>
              Montant: ${payment.amount} ${payment.currency}<br>
              Méthode: ${paymentMethod.toUpperCase()}<br>
              Date: ${new Date().toLocaleDateString()}<br>
              Référence: ${mdOrder}
            </div>

            <a href="${this.configService.get('CLIENT_BASE_URL')}/subscription/my-subscription" class="btn-return">Voir mon abonnement</a>
          </div>
        </body>
      </html>
    `;
    res.setHeader('Content-Type', 'text/html');
    return res.send(successPageHtml);
  }

  // Handle SlickPay payment return
  @Get('payment/return')
  @Public()
  async handleSlickPayReturn(@Query('paymentId') paymentId: string, @Res() res: any) {
    try {
      console.log(`🎯 Return URL accessed for paymentId: ${paymentId}`);

      const verifiedPayment = await this.paymentService.verifyPaymentStatus(paymentId);
      
      if (verifiedPayment.status === PaymentStatus.COMPLETED) {
        // This is a common case: the user returns to the site after a successful payment
        // We should redirect them to a success page
        console.log(`✅ Payment ${paymentId} is already completed. Redirecting to success.`);
        return res.redirect(`${this.configService.get('CLIENT_BASE_URL')}/subscription/payment/success?paymentId=${paymentId}`);
      } else {
        console.log(`⚠️ Payment ${paymentId} is still pending or failed. Status: ${verifiedPayment.status}`);
        return res.redirect(`${this.configService.get('CLIENT_BASE_URL')}/subscription/payment/pending?paymentId=${paymentId}`);
      }
    } catch (error) {
      console.error('❌ Error handling payment return:', error);
      return res.redirect(`${this.configService.get('CLIENT_BASE_URL')}/subscription/payment/error`);
    }
  }

  // Handle SlickPay payment failure
  @Get('payment/fail')
  @Public()
  async handlePaymentFailure(@Query('paymentId') paymentId: string, @Res() res: any) {
    try {
      console.log(`❌ Payment failure route accessed for paymentId: ${paymentId}`);
      
      const payment = await this.paymentService.getPaymentById(paymentId);
      
      if (payment) {
        await this.paymentService.updatePaymentStatus(paymentId, PaymentStatus.FAILED, {
          message: 'Payment failed based on redirect'
        });
      }
      
      return res.redirect(`${this.configService.get('CLIENT_BASE_URL')}/subscription/payment/error`);
    } catch (error) {
      console.error('❌ Error handling payment failure:', error);
      return res.redirect(`${this.configService.get('CLIENT_BASE_URL')}/subscription/payment/error`);
    }
  }
}