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

@Module({
  imports: [MongooseModule.forFeature([
    { name: Identity.name, schema: IdentitySchema },
    { name: Professional.name, schema: ProfessionalSchema },
    { name: User.name, schema: UserSchema },
    { name: Attachment.name, schema: AttachmentSchema },
  ]), SessionModule, AttachmentModule, forwardRef(() => UserModule), forwardRef(() => NotificationModule)],
  providers: [IdentityService],
  controllers: [IdentityController],
  exports: [IdentityService],
})
export class IdentityModule {} 