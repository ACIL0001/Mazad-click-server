import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SocketGateway } from 'src/socket/socket.gateway';
import { Chat, ChatSchema } from './schema/chat.schema';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { UserModule } from '../user/user.module';
import { MessageModule } from '../messages/messages.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Chat.name, schema: ChatSchema }]),
    UserModule,
    forwardRef(() => MessageModule),
  ],
  controllers: [ChatController],
  providers: [ChatService, SocketGateway],
  exports: [ChatService],
})
export class ChatModule { }