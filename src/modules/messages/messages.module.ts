import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Message, MessageSchema } from "./schema/schema.messages";
import { MessageController } from "./messages.controller";
import { MessageService } from "./messages.service";
import { SocketGateway } from "src/socket/socket.gateway";
import { NotificationModule } from "../notification/notification.module";
import { UserModule } from '../user/user.module';




@Module({
  imports: [
    MongooseModule.forFeature([{ name: Message.name, schema: MessageSchema}]),
    NotificationModule,
    UserModule,
  ],
  controllers: [MessageController],
  providers: [MessageService , SocketGateway],
  exports: [MessageService],
})
export class MessageModule {}