import { Controller, Post, Body, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ChatService } from "./chat.service";
import { Chat } from "./schema/chat.schema";
import { CrateChatDto } from "./dto/create-chat.dto";
import { DeletChatDto } from "./dto/delete.chat";
import { getChatDto } from "./dto/get.chat";
import { Query } from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';





import { BroadcastDto } from "./dto/broadcast.dto";

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly ChatService: ChatService) { }

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
    try {
      const result = await this.ChatService.getChat(dto.id, dto.from);
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

  @Get('guest-chats')
  async getGuestChats(): Promise<Chat[]> {
    return this.ChatService.getGuestChats();
  }

  @Get('find-guest-chat')
  @Public()
  async findGuestChat(
    @Query('name') name: string,
    @Query('phone') phone: string,
    @Query('guestUserId') guestUserId: string
  ): Promise<Chat | null> {
    if (!name || !phone || !guestUserId) {
      throw new Error('Name, phone, and guestUserId are required');
    }
    return this.ChatService.findGuestChatByInfo(name, phone, guestUserId);
  }

  @Post('broadcast')
  async broadcast(@Body() broadcastDto: BroadcastDto) {
    return this.ChatService.broadcastMessage(
      broadcastDto.message,
      broadcastDto.sender,
      broadcastDto.filterType,
      broadcastDto.filterValue
    );
  }
}