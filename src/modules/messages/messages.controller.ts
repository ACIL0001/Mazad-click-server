import { Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors, Request, BadRequestException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { MessageService } from "./messages.service";
import { CrateMessageDto } from "./dto/create.Message";
import { Message } from "./schema/schema.messages";
import { DeleteOneMessageDto } from "./dto/deleteOne.Message";
import { GetMessageDto } from "./dto/get.Message";
import { Public } from "src/common/decorators/public.decorator";
import { ChatService } from "../chat/chat.service";
import { UserService } from "../user/user.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname, join } from "path";
import * as fs from "fs";
import { AttachmentService } from "../attachment/attachment.service";
const resolveApiBaseUrl = (): string => {
  const envUrl = process.env.API_BASE_URL;
  if (envUrl && envUrl.trim() !== "") {
    return envUrl.trim().replace(/\/$/, "");
  }
  return (process.env.NODE_ENV === "production"
    ? "https://mazadclick-server.onrender.com"
    : "http://localhost:3000").replace(/\/$/, "");
};


@ApiTags('message')
@Controller('message')
export class MessageController {
  constructor(
    private readonly MessageService: MessageService,
    private readonly ChatService: ChatService,
    private readonly AttachmentService: AttachmentService,
    private readonly UserService: UserService
  ) {}

  @Post('create')
  async create(@Body() dto: CrateMessageDto): Promise<Message> {
    let chatId = dto.idChat;
    let reciver = dto.reciver;
    
    // If no chat ID provided or chat doesn't exist, create a new chat
    if (!chatId || chatId === 'undefined' || chatId === 'null') {
      try {
        // Fetch user details for both sender and receiver
        let senderUser: any = null;
        let receiverUser: any = null;
        
        try {
          senderUser = await this.UserService.findUserById(dto.sender);
          receiverUser = await this.UserService.findUserById(dto.reciver);
        } catch (error) {
        }
        
        // Check if chat already exists between these two users
        // Try both sender and receiver perspectives
        let foundExistingChat: any = null;
        try {
          const senderChats = await this.ChatService.getChat(dto.sender, 'seller');
          foundExistingChat = senderChats.find((chat: any) => 
            chat.users?.some((u: any) => {
              const userId = u._id?.toString() || u._id;
              return userId === dto.sender?.toString() || userId === dto.sender;
            }) &&
            chat.users?.some((u: any) => {
              const userId = u._id?.toString() || u._id;
              return userId === dto.reciver?.toString() || userId === dto.reciver;
            })
          );
          
          // If not found from sender perspective, try receiver perspective
          if (!foundExistingChat) {
            const receiverChats = await this.ChatService.getChat(dto.reciver, 'seller');
            foundExistingChat = receiverChats.find((chat: any) => 
              chat.users?.some((u: any) => {
                const userId = u._id?.toString() || u._id;
                return userId === dto.sender?.toString() || userId === dto.sender;
              }) &&
              chat.users?.some((u: any) => {
                const userId = u._id?.toString() || u._id;
                return userId === dto.reciver?.toString() || userId === dto.reciver;
              })
            );
          }
        } catch (error) {
        }
        
        if (foundExistingChat) {
          chatId = foundExistingChat._id;
        } else {
          // Create new chat with user details
          const chatUsers = [
            {
              _id: senderUser?._id?.toString() || dto.sender,
              firstName: senderUser?.firstName || '',
              lastName: senderUser?.lastName || '',
              AccountType: senderUser?.AccountType || '',
              phone: senderUser?.phone || ''
            },
            {
              _id: receiverUser?._id?.toString() || dto.reciver,
              firstName: receiverUser?.firstName || '',
              lastName: receiverUser?.lastName || '',
              AccountType: receiverUser?.AccountType || '',
              phone: receiverUser?.phone || ''
            }
          ];
          
          const newChat = await this.ChatService.create(chatUsers, new Date().toISOString());
          chatId = newChat._id;
        }
      } catch (error) {
        console.error('❌ Error creating chat:', error);
        // Continue with original chatId (might be invalid, but let message service handle it)
      }
    }

    // Resolve unique guest receiver ID if sending to guest from admin
    if ((dto.sender === 'admin' || dto.sender === 'ADMIN') && (reciver === 'guest' || reciver === 'GUEST') && chatId) {
      try {
        const chat = await this.ChatService.findChatById(chatId);
        if (chat) {
          const guestUser = chat.users.find((u: any) => u._id !== 'admin' && u.AccountType !== 'admin') as any;
          if (guestUser) {
            reciver = guestUser._id;
            dto.reciver = guestUser._id;
          }
        }
      } catch (error) {
        console.error('❌ Error resolving guest user ID for admin response:', error);
      }
    }
    
    return this.MessageService.create(
      dto.sender,
      reciver,
      dto.message,
      chatId,
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
    guestUserId?: string;
    attachment?: {
      _id: string;
      url: string;
      name: string;
      type: string;
      size: number;
      filename: string;
    };
  }): Promise<Message> {
    const guestId = dto.guestUserId;
    if (!guestId || guestId === 'guest') {
      throw new BadRequestException('guestUserId is required and must be unique');
    }
    
    // Generate a unique chat ID if not provided
    const chatId = dto.idChat || `guest-chat-${Date.now()}`;
    
    try {
      // First, check if a chat already exists for this guest
      let existingChat = null;
      
      // If a chat ID is provided, try to find that specific chat first and verify it belongs to this guest
      if (dto.idChat && dto.idChat !== 'pending-server-creation' && dto.idChat !== 'undefined' && dto.idChat !== 'null') {
        try {
          const chats = await this.ChatService.getChat('admin', 'admin');
          existingChat = chats.find((chat: any) => 
            chat._id.toString() === dto.idChat &&
            chat.users?.some((user: any) => user._id === guestId)
          );
        } catch (error) {
        }
      }
      
      // If not found by ID, try to find by guestId to resume correctly
      if (!existingChat) {
        try {
          const chats = await this.ChatService.getChat('admin', 'admin');
          existingChat = chats.find((chat: any) => 
            chat.users?.some((user: any) => user._id === guestId) &&
            chat.users?.some((user: any) => user.AccountType === 'admin')
          );
        } catch (error) {
        }
      }
      
      // If no existing chat, create a new one
      if (!existingChat) {
        const guestChatUsers = [
          {
            _id: guestId,
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
      }
      
      // Use the existing or newly created chat ID
      const finalChatId = existingChat._id || chatId;
      
      // Create the guest message
      const message = await this.MessageService.create(
        guestId, // sender
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
    @Body('guestPhone') guestPhone?: string,
    @Body('guestUserId') guestUserId?: string
  ): Promise<Message> {
    try {
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
      // Create the voice message with attachment info
      const attachmentAny = attachment as any;
      const attachmentInfo = {
        _id: attachmentAny._id || attachmentAny.id || '',
        url: attachmentAny.fullUrl || attachmentAny.url || `${resolveApiBaseUrl()}/static/${attachmentAny.filename}`,
        // url: attachmentAny.fullUrl || attachmentAny.url || `http://localhost:3000/static/${attachmentAny.filename}`,
        name: attachmentAny.originalname || file.originalname,
        type: attachmentAny.mimetype || file.mimetype,
        size: attachmentAny.size || file.size,
        filename: attachmentAny.filename || file.filename
      };
      // Check if this is a guest message
      const isGuest = !req.session?.user?._id && (guestName || guestPhone);
      const guestId = guestUserId || 'guest';

      if (isGuest) {
        if (!guestUserId || guestUserId === 'guest') {
          throw new BadRequestException('guestUserId is required');
        }
        // Handle guest voice message
        let existingChat = null;
        
        // If a chat ID is provided, try to find that specific chat first and verify it belongs to this guest
        if (idChat && idChat !== 'pending-server-creation' && idChat !== 'undefined' && idChat !== 'null') {
          try {
            const chats = await this.ChatService.getChat('admin', 'admin');
            existingChat = chats.find((chat: any) => 
              chat._id.toString() === idChat &&
              chat.users?.some((user: any) => user._id === guestId)
            );
          } catch (error) {
          }
        }
        
        // If not found by ID, try to find by guestId to resume correctly
        if (!existingChat) {
          try {
            const chats = await this.ChatService.getChat('admin', 'admin');
            existingChat = chats.find((chat: any) => 
              chat.users?.some((user: any) => user._id === guestId) &&
              chat.users?.some((user: any) => user.AccountType === 'admin')
            );
          } catch (error) {
          }
        }
        
        const finalChatId = existingChat?._id || idChat;
        
        const message = await this.MessageService.create(
          guestId,
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
        return message;
      }
    } catch (error) {
      console.error('❌ Error creating voice message:', error);
      throw error;
    }
  }
}