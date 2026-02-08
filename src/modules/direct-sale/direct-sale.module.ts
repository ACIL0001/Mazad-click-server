import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DirectSaleController } from './direct-sale.controller';
import { DirectSaleService } from './direct-sale.service';
import {
  DirectSale,
  DirectSaleSchema,
  DirectSalePurchase,
  DirectSalePurchaseSchema,
} from './schema/direct-sale.schema';
import { CategoryModule } from '../category/category.module';
import { SessionModule } from '../session/session.module';
import { NotificationModule } from '../notification/notification.module';
import { UserModule } from '../user/user.module';
import { AttachmentModule } from '../attachment/attachment.module';
import { ChatModule } from '../chat/chat.module';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DirectSale.name, schema: DirectSaleSchema },
      { name: DirectSalePurchase.name, schema: DirectSalePurchaseSchema },
    ]),
    CategoryModule,
    SessionModule,
    NotificationModule,
    UserModule,
    AttachmentModule,
    ChatModule,
    SearchModule,
  ],
  controllers: [DirectSaleController],
  providers: [DirectSaleService],
  exports: [DirectSaleService],
})
export class DirectSaleModule {
  constructor() {
    console.log('✅ DirectSaleModule loaded successfully');
  }
}

