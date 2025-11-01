import { Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors, Request } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { MessageService } from "./messages.service";
import { CrateMessageDto } from "./dto/create.Message";
import { Message } from "./schema/schema.messages";
import { DeleteOneMessageDto } from "./dto/deleteOne.Message";
import { GetMessageDto } from "./dto/get.Message";
import { Public } from "src/common/decorators/public.decorator";
import { ChatService } from "../chat/chat.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname, join } from "path";
import * as fs from "fs";
import { AttachmentService } from "../attachment/attachment.service";





@ApiTags('message')
@Controller('message')
export class MessageController {
  constructor(
    private readonly MessageService: MessageService,
    private readonly ChatService: ChatService,
    private readonly AttachmentService: AttachmentService
  ) {}

  @Post('create')
  async create(@Body() dto: CrateMessageDto): Promise<Message> {
    return this.MessageService.create(
      dto.sender,
      dto.reciver,
      dto.message,
      dto.idChat,
      { attachment: dto.attachment }
    );
  }

  @Get('getAll/:idChat')
  @Public()
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

  @Post('guest-message')
  @Public() // This endpoint doesn't require authentication
  async createGuestMessage(@Body() dto: {
    message: string;
    guestName: string;
    guestPhone: string;
    idChat?: string;
    attachment?: {
      _id: string;
      url: string;
      name: string;
      type: string;
      size: number;
      filename: string;
    };
  }): Promise<Message> {
    console.log('📨 Guest message received:', dto);
    
    // Generate a unique chat ID if not provided
    const chatId = dto.idChat || `guest-chat-${Date.now()}`;
    
    try {
      // First, check if a chat already exists for this guest
      let existingChat = null;
      try {
        // Try to find existing guest chat by looking for chats with guest user
        const chats = await this.ChatService.getChat('admin', 'admin');
        existingChat = chats.find((chat: any) => 
          chat.users?.some((user: any) => user._id === 'guest') &&
          chat.users?.some((user: any) => user.AccountType === 'admin')
        );
        console.log('🔍 Existing guest chat found:', existingChat?._id);
      } catch (error) {
        console.log('🔍 No existing guest chat found or error:', error);
      }
      
      // If no existing chat, create a new one
      if (!existingChat) {
        console.log('📝 Creating new guest chat...');
        const guestChatUsers = [
          {
            _id: 'guest',
            firstName: dto.guestName,
            lastName: 'User',
            AccountType: 'guest',
            phone: dto.guestPhone
          },
          {
            _id: 'admin',
            firstName: 'Admin',
            lastName: 'Support',
            AccountType: 'admin',
            phone: ''
          }
        ];
        
        existingChat = await this.ChatService.create(guestChatUsers, new Date().toISOString());
        console.log('✅ Guest chat created:', existingChat._id);
      }
      
      // Use the existing or newly created chat ID
      const finalChatId = existingChat._id || chatId;
      
      // Create the guest message
      const message = await this.MessageService.create(
        'guest', // sender
        'admin', // receiver
        dto.message,
        finalChatId,
        {
          guestName: dto.guestName,
          guestPhone: dto.guestPhone,
          isGuestMessage: true,
          attachment: dto.attachment
        }
      );
      
      console.log('✅ Guest message created:', message._id);
      return message;
    } catch (error) {
      console.error('❌ Error creating guest message:', error);
      throw error;
    }
  }

  @Post('voice-message')
  @Public()
  @UseInterceptors(FileInterceptor('audio', {
    storage: diskStorage({
      destination: (req, file, callback) => {
        const uploadsDir = join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        callback(null, uploadsDir);
      },
      filename: (req, file, callback) => {
        const name = file.originalname.split('.')[0];
        const fileExtName = extname(file.originalname);
        const randomName = Array(4)
          .fill(null)
          .map(() => Math.round(Math.random() * 16).toString(16))
          .join('');
        callback(null, `voice-${name}-${randomName}${fileExtName}`);
      },
    }),
  }))
  async createVoiceMessage(
    @UploadedFile() file: Express.Multer.File,
    @Body('sender') sender: string,
    @Body('reciver') reciver: string,
    @Body('idChat') idChat: string,
    @Request() req,
    @Body('guestName') guestName?: string,
    @Body('guestPhone') guestPhone?: string
  ): Promise<Message> {
    try {
      console.log('🎤 Voice message received:', {
        filename: file?.originalname,
        sender,
        reciver,
        idChat,
        guestName,
        guestPhone
      });

      if (!file) {
        throw new Error('No audio file provided');
      }

      // Get userId for attachment (null for guest users)
      const userId = req.session?.user?._id || req.body?.userId || null;

      // Upload the audio file as an attachment
      const attachment = await this.AttachmentService.upload(
        file,
        'MESSAGE',
        userId
      );

      console.log('✅ Voice attachment uploaded:', attachment);

      // Create the voice message with attachment info
      const attachmentAny = attachment as any;
      
      console.log('📎 Creating attachment info:', {
        'attachment._id': attachmentAny._id,
        'attachment.size': attachmentAny.size,
        'file.size': file.size,
        'attachment.mimetype': attachmentAny.mimetype,
        'file.mimetype': file.mimetype
      });
      
      const attachmentInfo = {
        _id: attachmentAny._id || attachmentAny.id || '',
        url: attachmentAny.fullUrl || attachmentAny.url || `https://mazadclick-server.onrender.com/static/${attachmentAny.filename}`,
        name: attachmentAny.originalname || file.originalname,
        type: attachmentAny.mimetype || file.mimetype,
        size: attachmentAny.size || file.size,
        filename: attachmentAny.filename || file.filename
      };
      
      console.log('📎 Final attachment info:', attachmentInfo);

      // Check if this is a guest message
      const isGuest = !req.session?.user?._id && (guestName || guestPhone);

      if (isGuest) {
        // Handle guest voice message
        let existingChat = null;
        try {
          const chats = await this.ChatService.getChat('admin', 'admin');
          existingChat = chats.find((chat: any) => 
            chat.users?.some((user: any) => user._id === 'guest') &&
            chat.users?.some((user: any) => user.AccountType === 'admin')
          );
        } catch (error) {
          console.log('🔍 No existing guest chat found');
        }
        
        const finalChatId = existingChat?._id || idChat;
        
        const message = await this.MessageService.create(
          'guest',
          'admin',
          '🎤 Voice message',
          finalChatId,
          {
            guestName,
            guestPhone,
            isGuestMessage: true,
            attachment: attachmentInfo
          }
        );

        console.log('✅ Guest voice message created:', message._id);
        return message;
      } else {
        // Handle authenticated user voice message
        const message = await this.MessageService.create(
          sender,
          reciver,
          '🎤 Voice message',
          idChat,
          {
            attachment: attachmentInfo
          }
        );

        console.log('✅ Authenticated voice message created:', message._id);
        return message;
      }
    } catch (error) {
      console.error('❌ Error creating voice message:', error);
      throw error;
    }
  }
}