import { Module, forwardRef } from '@nestjs/common';
import { UserService } from './user.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schema/user.schema';
import { AdminService } from './services/admin.service';
import { UserController } from './user.controller';
import { AdminController } from './admin.controller';
import { Admin, AdminSchema } from './schema/admin.schema';
import { SessionModule } from '../session/session.module';
import { Professional, ProfessionalSchema } from './schema/pro.schema';
import { Buyer, BuyerSchema } from './schema/client.schema';
import { ProService } from './services/pro.service';
import { ClientService } from './services/client.service';
import { AttachmentModule } from '../attachment/attachment.module';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Professional.name, schema: ProfessionalSchema },
      { name: Buyer.name, schema: BuyerSchema },
      { name: Admin.name, schema: AdminSchema },
    ]),
    SessionModule,
    AttachmentModule,
    forwardRef(() => IdentityModule),
  ],
  providers: [UserService, AdminService, ClientService, ProService],
  controllers: [UserController, AdminController],
  exports: [UserService, AdminService, ClientService, ProService],
})
export class UserModule {}
