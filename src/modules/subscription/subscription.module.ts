import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { PaymentService } from './services/payment.service';
import { SatimPaymentService } from './services/satim-payment.service';
import { Subscription, SubscriptionSchema } from './schema/subscription.schema';
import { Plan, PlanSchema } from './schema/plan.schema';
import { Payment, PaymentSchema } from './schema/payment.schema';
import { UserModule } from '../user/user.module';
import { SessionModule } from '../session/session.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Plan.name, schema: PlanSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
    ConfigModule,
    forwardRef(() => UserModule),
    SessionModule,
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, PaymentService, SatimPaymentService],
  exports: [SubscriptionService, PaymentService, SatimPaymentService],
})
export class SubscriptionModule {}
