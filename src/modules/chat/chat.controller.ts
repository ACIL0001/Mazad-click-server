import { Controller, Post , Body, Get} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ChatService } from "./chat.service";
import { Chat } from "./schema/chat.schema";
import { CrateChatDto } from "./dto/create-chat.dto";
import { DeletChatDto } from "./dto/delete.chat";
import { getChatDto } from "./dto/get.chat";
import { Query } from '@nestjs/common';





@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly ChatService: ChatService) {}

  @Post('create')
  async create(@Body() dto: CrateChatDto): Promise<Chat> {
    return this.ChatService.create(dto.users, dto.createdAt);
  }

  @Post('delete')
  async deletChat(@Body() dto: DeletChatDto): Promise<Chat> {
    return this.ChatService.deletChat(dto.id);
  }

  @Post('getchats')
  async getChat(@Body() dto: getChatDto): Promise<Chat[]> {
    console.log('🔍 ChatController.getChat called with:');
    console.log('  - id:', dto.id, '(type:', typeof dto.id, ')');
    console.log('  - from:', dto.from, '(type:', typeof dto.from, ')');
    
    try {
      const result = await this.ChatService.getChat(dto.id, dto.from);
      console.log('✅ ChatController returning:', result.length, 'chats');
      return result;
    } catch (error) {
      console.error('❌ ChatController error:', error);
      throw error;
    }
  }

  @Get('admin-chats')
  async getAdminChats(): Promise<Chat[]> {
    return this.ChatService.getChatsByAdmin();
  }
}