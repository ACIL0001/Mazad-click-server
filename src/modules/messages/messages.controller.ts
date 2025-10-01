import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { MessageService } from "./messages.service";
import { CrateMessageDto } from "./dto/create.Message";
import { Message } from "./schema/schema.messages";
import { DeleteOneMessageDto } from "./dto/deleteOne.Message";
import { GetMessageDto } from "./dto/get.Message";





@ApiTags('message')
@Controller('message')
export class MessageController {
  constructor(private readonly MessageService: MessageService) {}

  @Post('create')
  async create(@Body() dto: CrateMessageDto): Promise<Message> {
    return this.MessageService.create(
      dto.sender,
      dto.reciver,
      dto.message,
      dto.idChat,
    );
  }

  @Get('getAll/:idChat')
  async getAll(@Param('idChat') idChat: string): Promise<Message[]> {
    return this.MessageService.getAll(idChat);
  }

  @Post('deleteOne')
  async deleteOne(@Body() dto: DeleteOneMessageDto): Promise<Message[]> {
    return this.MessageService.getAll(dto.id);
  }

  @Post('deleteAll')
  async deleteAll(): Promise<void> {
    this.MessageService.deleteAll();
    return;
  }
  
  @Post('mark-read/:chatId')
  async markAllAsRead(@Param('chatId') chatId: string): Promise<{ modifiedCount: number }> {
    return this.MessageService.markAllAsRead(chatId);
  }

  @Get('unread-count/:userId')
  async getUnreadCount(@Param('userId') userId: string): Promise<{ count: number }> {
    return this.MessageService.getUnreadCount(userId);
  }

  @Post('mark-chat-read')
  async markChatAsRead(@Body() body: { chatId: string; userId: string }): Promise<{ messageCount: number; notificationCount: number }> {
    return this.MessageService.markChatAsRead(body.chatId, body.userId);
  }

  @Get('unread-messages/:userId')
  async getUnreadMessages(@Param('userId') userId: string): Promise<Message[]> {
    return this.MessageService.getUnreadMessages(userId);
  }
}