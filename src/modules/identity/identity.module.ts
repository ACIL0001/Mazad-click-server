import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Identity, IdentitySchema } from './identity.schema';
import { IdentityService } from './identity.service';
import { IdentityController } from './identity.controller';
import { Professional, ProfessionalSchema } from '../user/schema/pro.schema';
import { User, UserSchema } from '../user/schema/user.schema';
import { SessionModule } from '../session/session.module';
import { Attachment, AttachmentSchema } from '../attachment/schema/attachment.schema';
import { AttachmentModule } from '../attachment/attachment.module';
import { UserModule } from '../user/user.module';
import { NotificationModule } from '../notification/notification.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { Plan, PlanSchema } from '../subscription/schema/plan.schema';
import { Subscription, SubscriptionSchema } from '../subscription/schema/subscription.schema';
import { SocketModule } from '../../socket/socket.module';

@Module({
  imports: [MongooseModule.forFeature([
    { name: Identity.name, schema: IdentitySchema },
    { name: Professional.name, schema: ProfessionalSchema },
    { name: User.name, schema: UserSchema },
    { name: Attachment.name, schema: AttachmentSchema },
    { name: Plan.name, schema: PlanSchema },
    { name: Subscription.name, schema: SubscriptionSchema },
  ]), SessionModule, AttachmentModule, forwardRef(() => UserModule), forwardRef(() => NotificationModule), forwardRef(() => SubscriptionModule), forwardRef(() => SocketModule)],
  providers: [IdentityService],
  controllers: [IdentityController],
  exports: [IdentityService],
})
export class IdentityModule { } 