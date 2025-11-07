import { Injectable, BadRequestException, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Subscription,
  SubscriptionDocument,
} from './schema/subscription.schema';
import { Plan, PlanDocument } from './schema/plan.schema';
import { PaymentService, CreatePaymentDto } from './services/payment.service';
import { Payment, PaymentStatus } from './schema/payment.schema';
import { UserService } from '../user/user.service';

export interface CreateSubscriptionDto {
  userId: string;
  planId: string;
  paymentData: {
    userInfo: {
      firstName: string;
      lastName: string;
      phone: string;
      email: string;
    };
    returnUrl?: string;
    paymentMethod?: string;
  };
}

@Injectable()
export class SubscriptionService implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(Plan.name)
    private planModel: Model<PlanDocument>,
    private paymentService: PaymentService,
    private userService: UserService,
  ) {}

  /**
   * Initialize default plans when module starts
   */
  async onModuleInit() {
    await this.createDefaultPlans();
  }

  /**
   * Get all subscriptions
   */
  async findAll() {
    try {
      // Correctly populate the user and plan fields
      const subscriptions = await this.subscriptionModel
        .find()
        .populate('user')
        .populate('plan')
        .exec();

      this.logger.log(`Found ${subscriptions.length} subscriptions`);

      // Map the results to a new structure that the frontend expects
      return subscriptions.map((sub) => {
        // Access populated fields directly
        const user = sub.user;
        const plan = sub.plan;

        // Handle null/undefined user or plan
        if (!user || !plan) {
          this.logger.warn(`Subscription ${sub._id} has missing user or plan. User: ${!!user}, Plan: ${!!plan}`);
          return {
            _id: sub._id,
            userId: user?._id?.toString() || 'unknown',
            planId: plan?._id?.toString() || 'unknown',
            planName: plan?.name || 'Unknown Plan',
            planPrice: plan?.price || 0,
            planDuration: plan?.duration || 0,
            startDate: sub.createdAt,
            endDate: sub.expiresAt,
            isActive: sub.expiresAt > new Date(),
            status: sub.expiresAt > new Date() ? 'Active' : 'Expired',
            error: !user || !plan ? 'Missing user or plan reference' : undefined,
          };
        }

        // Calculate isActive status and map to a readable string
        const status = sub.expiresAt > new Date() ? 'Active' : 'Expired';
        const isActive = sub.expiresAt > new Date();

        return {
          _id: sub._id,
          userId: user._id.toString(),
          planId: plan._id.toString(),
          planName: plan.name,
          planPrice: plan.price,
          planDuration: plan.duration,
          startDate: sub.createdAt,
          endDate: sub.expiresAt,
          isActive: isActive,
          status: status,
        };
      });
    } catch (error) {
      this.logger.error('Error in findAll subscriptions:', error);
      throw new BadRequestException('Failed to fetch subscriptions: ' + error.message);
    }
  }

  /**
   * Create subscription with payment
   */
  async createSubscriptionWithPayment(createSubscriptionDto: CreateSubscriptionDto): Promise<{ subscription: Subscription; payment: Payment }> {
    try {
      this.logger.log(`Creating subscription for user ${createSubscriptionDto.userId}, plan: ${createSubscriptionDto.planId}`);

      // Find the subscription plan
      this.logger.log(`Attempting to find plan with ID: ${createSubscriptionDto.planId}`);
      const plan = await this.findPlanById(createSubscriptionDto.planId);
      if (!plan) {
        this.logger.error(`Plan not found for ID: ${createSubscriptionDto.planId}`);
        // Let's also log all available plans for debugging
        const allPlans = await this.findAllPlans();
        this.logger.log(`Available plans: ${allPlans.map(p => p.name).join(', ')}`);
        throw new BadRequestException('Subscription plan not found');
      }
      this.logger.log(`Found plan: ${plan.name} with price: ${plan.price}`);

      // Check if user already has an active subscription
      const existingSubscription = await this.findActiveSubscriptionByUserId(createSubscriptionDto.userId);
      if (existingSubscription) {
        this.logger.log(`User ${createSubscriptionDto.userId} has existing subscription, allowing upgrade/change`);
        // Instead of blocking, we'll allow the new subscription to be created
        // The old subscription will be handled during payment confirmation
      }

      // Create payment first
      const paymentDto: CreatePaymentDto = {
        userId: createSubscriptionDto.userId,
        subscriptionPlan: createSubscriptionDto.planId,
        amount: plan.price,
        userInfo: createSubscriptionDto.paymentData.userInfo,
        returnUrl: createSubscriptionDto.paymentData.returnUrl,
        paymentMethod: createSubscriptionDto.paymentData.paymentMethod,
      };

      const payment = await this.paymentService.createPayment(paymentDto);

      // Create subscription in PENDING status
      const expirationDate = this.calculateExpirationDate(plan);
      const subscription = new this.subscriptionModel({
        id: payment._id.toString(), // Use payment ID as subscription ID
        user: createSubscriptionDto.userId,
        plan: plan._id,
        expiresAt: expirationDate,
      });

      await subscription.save();

      this.logger.log(`Subscription created successfully: ${subscription._id}`);
      return { subscription, payment };

    } catch (error) {
      this.logger.error('Error creating subscription with payment:', error);
      throw new BadRequestException('Failed to create subscription: ' + error.message);
    }
  }

  /**
   * Confirm subscription payment
   */
  async confirmSubscriptionPayment(paymentId: string): Promise<{ subscription: Subscription; payment: Payment }> {
    try {
      // Verify payment status
      const payment = await this.paymentService.verifyPaymentStatus(paymentId);
      
      if (payment.status !== PaymentStatus.COMPLETED) {
        throw new BadRequestException('Payment not completed');
      }

      // Find subscription by payment ID
      const subscription = await this.subscriptionModel.findOne({ id: paymentId }).populate('user').populate('plan');
      
      if (!subscription) {
        throw new BadRequestException('Subscription not found');
      }

      // Check if user has an existing active subscription
      const existingSubscription = await this.findActiveSubscriptionByUserId(payment.user._id.toString());
      
      if (existingSubscription && existingSubscription._id.toString() !== subscription._id.toString()) {
        this.logger.log(`User ${payment.user._id} has existing subscription, handling upgrade/change`);
        
        // Handle subscription upgrade/change logic
        const newPlan = await this.findPlanById(payment.subscriptionPlan);
        const existingPlan = await this.findPlanById(existingSubscription.plan._id.toString());
        
        if (newPlan && existingPlan) {
          // Calculate new expiration date
          let newExpirationDate: Date;
          
          if (newPlan.duration > existingPlan.duration) {
            // Upgrade: extend from current expiration
            newExpirationDate = new Date(existingSubscription.expiresAt);
            newExpirationDate.setMonth(newExpirationDate.getMonth() + newPlan.duration);
            this.logger.log(`Upgrading subscription: extending from ${existingSubscription.expiresAt} to ${newExpirationDate}`);
          } else {
            // Downgrade or same duration: replace with new expiration
            newExpirationDate = this.calculateExpirationDate(newPlan);
            this.logger.log(`Changing subscription: new expiration ${newExpirationDate}`);
          }
          
          // Update the new subscription with the calculated expiration
          subscription.expiresAt = newExpirationDate;
          await subscription.save();
          
          // Mark old subscription as cancelled (optional - you might want to keep it for history)
          // await this.subscriptionModel.findByIdAndUpdate(existingSubscription._id, { 
          //   $set: { status: 'cancelled', cancelledAt: new Date() } 
          // });
        }
      }

      // Update user subscription plan in User model
      await this.userService.updateSubscriptionPlan(payment.user._id.toString(), payment.subscriptionPlan);

      this.logger.log(`Subscription payment confirmed for user ${payment.user._id}, plan: ${payment.subscriptionPlan}`);
      return { subscription, payment };

    } catch (error) {
      this.logger.error('Error confirming subscription payment:', error);
      throw new BadRequestException('Failed to confirm subscription payment: ' + error.message);
    }
  }

  /**
   * Get subscription by user ID
   */
  async findActiveSubscriptionByUserId(userId: string): Promise<Subscription | null> {
    return this.subscriptionModel
      .findOne({ 
        user: userId, 
        expiresAt: { $gt: new Date() } 
      })
      .populate('user')
      .populate('plan')
      .exec();
  }

  /**
   * Get all subscriptions by user ID (including inactive)
   */
  async findAllSubscriptionsByUserId(userId: string): Promise<Subscription[]> {
    return this.subscriptionModel
      .find({ user: userId })
      .populate('user')
      .populate('plan')
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Get subscription by ID
   */
  async findSubscriptionById(subscriptionId: string): Promise<Subscription | null> {
    return this.subscriptionModel
      .findById(subscriptionId)
      .populate('user')
      .populate('plan')
      .exec();
  }

  /**
   * Create default subscription plans if they don't exist
   */
  async createDefaultPlans(): Promise<void> {
    try {
      this.logger.log('Checking for existing plans...');
      const existingPlans = await this.planModel.countDocuments();
      this.logger.log(`Found ${existingPlans} existing plans`);
      
      if (existingPlans === 0) {
        this.logger.log('No plans found, creating default plans...');
        const defaultPlans = [
          // Professional Plans
          {
            name: '6mois',
            description: 'Accédez à un réseau de professionnels et facilitez vos enchères pendant 6 mois.',
            price: 8000,
            duration: 6, // 6 months
            role: 'PROFESSIONAL',
            isActive: true
          },
          {
            name: '1an',
            description: "Profitez d'avantages exclusifs pour développer votre activité et votre réputation pendant 1 an.",
            price: 10000,
            duration: 12, // 12 months
            role: 'PROFESSIONAL',
            isActive: true
          },
          // Reseller Plans
          {
            name: '6mois',
            description: 'Accédez à des outils avancés de revente et maximisez vos profits pendant 6 mois.',
            price: 12000,
            duration: 6, // 6 months
            role: 'RESELLER',
            isActive: true
          },
          {
            name: '1an',
            description: "Profitez d'avantages premium pour développer votre réseau de revente pendant 1 an.",
            price: 15000,
            duration: 12, // 12 months
            role: 'RESELLER',
            isActive: true
          }
        ];
        const createdPlans = await this.planModel.insertMany(defaultPlans);
        this.logger.log(`Default subscription plans created: ${createdPlans.map(p => `${p.name} (${p.role})`).join(', ')}`);
      } else {
        this.logger.log('Plans already exist, skipping creation');
        // Log existing plans for debugging
        const plans = await this.planModel.find().exec();
        this.logger.log(`Existing plans: ${plans.map(p => `${p.name} (${p.role})`).join(', ')}`);
      }
    } catch (error) {
      this.logger.error('Error creating default plans:', error);
    }
  }

  /**
   * Get all available plans
   */
  async findAllPlans(): Promise<Plan[]> {
    return this.planModel.find().exec();
  }

  /**
   * Get plans by role
   */
  async findPlansByRole(role: string): Promise<Plan[]> {
    return this.planModel.find({ role, isActive: true }).exec();
  }

  /**
   * Find plan by ID
   */
  async findPlanById(planId: string): Promise<Plan | null> {
    this.logger.log(`Looking for plan with ID: ${planId}`);
    let plan: Plan | null = null;
    // First try to find by _id if it's a valid ObjectId
    if (Types.ObjectId.isValid(planId)) {
      plan = await this.planModel.findById(planId).exec();
      if (plan) {
        this.logger.log(`Found plan by ObjectId: ${plan.name}`);
        return plan;
      }
    }

    // Then try to find by name
    plan = await this.planModel.findOne({ name: planId }).exec();
    if (plan) {
      this.logger.log(`Found plan by name: ${plan.name}`);
      return plan;
    }

    // Log all available plans for debugging
    const allPlans = await this.planModel.find().exec();
    this.logger.error(`Plan not found. Available plans: ${JSON.stringify(allPlans.map(p => ({ id: p._id, name: p.name })))}`);
    return null;
  }

  /**
   * Calculate subscription expiration date based on plan
   */
  private calculateExpirationDate(plan: Plan): Date {
    const now = new Date();
    if (plan.name === '6mois') {
      return new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000); // 6 months
    } else if (plan.name === '1an') {
      return new Date(now.getTime() + 12 * 30 * 24 * 60 * 60 * 1000); // 12 months
    }
    return new Date();
  }

  /**
   * Create a new subscription plan
   */
  async createPlan(planData: any): Promise<Plan> {
    try {
      const existingPlan = await this.planModel.findOne({ name: planData.name }).exec();
      if (existingPlan) {
        throw new BadRequestException('Plan with this name already exists');
      }

      const newPlan = new this.planModel(planData);
      const createdPlan = await newPlan.save();
      this.logger.log(`Plan created: ${createdPlan.name}`);
      return createdPlan;
    } catch (error) {
      this.logger.error('Error creating plan:', error);
      throw new BadRequestException('Failed to create plan: ' + error.message);
    }
  }

  /**
   * Update a subscription plan
   */
  async updatePlan(planId: string, planData: any): Promise<Plan> {
    try {
      // Check if the new name is not a duplicate
      if (planData.name) {
        const existingPlan = await this.planModel.findOne({ name: planData.name, _id: { $ne: planId } }).exec();
        if (existingPlan) {
          throw new BadRequestException('Plan with this name already exists');
        }
      }

      const updatedPlan = await this.planModel.findByIdAndUpdate(
        planId,
        planData,
        { new: true }
      ).exec();

      this.logger.log(`Plan updated: ${updatedPlan.name}`);
      return updatedPlan;
    } catch (error) {
      this.logger.error('Error updating plan:', error);
      throw new BadRequestException('Failed to update plan: ' + error.message);
    }
  }

  /**
   * Delete a subscription plan
   */
  async deletePlan(planId: string): Promise<void> {
    try {
      const plan = await this.planModel.findById(planId).exec();
      if (!plan) {
        throw new BadRequestException('Plan not found');
      }

      // Check if plan is being used by any active subscriptions
      const activeSubscriptions = await this.subscriptionModel.countDocuments({
        plan: planId,
        expiresAt: { $gt: new Date() }
      });

      if (activeSubscriptions > 0) {
        throw new BadRequestException('Cannot delete plan that has active subscriptions');
      }

      await this.planModel.findByIdAndDelete(planId).exec();
      this.logger.log(`Plan deleted: ${plan.name}`);
    } catch (error) {
      this.logger.error('Error deleting plan:', error);
      throw new BadRequestException('Failed to delete plan: ' + error.message);
    }
  }
}