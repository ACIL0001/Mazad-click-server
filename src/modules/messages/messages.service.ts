import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Message, MessageDocument } from "./schema/schema.messages";
import { Model } from "mongoose";
import { SocketGateway } from "src/socket/socket.gateway";
import { NotificationService } from "../notification/notification.service";
import { NotificationType } from "../notification/schema/notification.schema";
import { log } from "util";
import { UserService } from '../user/user.service';
import { RoleCode } from '../apikey/entity/appType.entity';
const resolveApiBaseUrl = (): string => {
  const envUrl = process.env.API_BASE_URL;
  if (envUrl && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/$/, '');
  }
  return (process.env.NODE_ENV === 'production'
    ? 'https://mazadclick-server.onrender.com'
    : 'http://localhost:3000').replace(/\/$/, '');
};


@Injectable()
export class MessageService {
  constructor(
    @InjectModel(Message.name)
    private MessageModel: Model<MessageDocument>,
    private readonly MessageSocket: SocketGateway,
    private readonly notificationService: NotificationService,
    private readonly userService: UserService,
  ) { }

  async create(
    sender: string,
    reciver: string,
    message: string,
    idChat: string,
    metadata?: any
  ): Promise<Message> {
    let date = new Date()
    const createMessage = new this.MessageModel({
      sender,
      reciver,
      message,
      idChat,
      createdAt: date,
      isRead: false,
      attachment: metadata?.attachment, // Include attachment if provided
      ...metadata // Include any additional metadata (like guest info)
    });

    // Save message to database first
    await createMessage.save();
    console.log('💾 Message saved to database:', {
      messageId: createMessage._id,
      sender,
      reciver,
      message,
      idChat,
      hasAttachment: !!createMessage.attachment,
      attachment: createMessage.attachment
    });

    // Enhanced logging for debugging
    console.log('🔍 Message analysis:', {
      sender,
      reciver,
      isReciverAdmin: reciver === 'admin' || reciver === 'ADMIN',
      isSenderAdmin: sender === 'admin' || sender === 'ADMIN',
      messageLength: message.length,
      messageId: createMessage._id
    });

    // Check if receiver is 'admin' (special case for admin chat)
    const isReciverAdmin = reciver === 'admin' || reciver === 'ADMIN';
    const isSenderAdmin = sender === 'admin' || sender === 'ADMIN';

    if (isReciverAdmin) {
      // User is sending message to admin - send to ALL admin users
      try {
        const admins = await this.userService.findUsersByRoles([RoleCode.ADMIN]);
        console.log('📨 Sending message to all admins:', admins.length);
        console.log('📨 Admin IDs:', admins.map(admin => admin._id));

        // Send message via socket to all admins (including attachment data)
        const adminIds = [...new Set(admins.map(admin => admin._id.toString()))];
        console.log('📨 Unique Admin IDs to notify:', adminIds);
        this.MessageSocket.sendMessageToAllAdmins(sender, adminIds, message, idChat, createMessage._id, createMessage.attachment);
        console.log('✅ Socket message sent to all admins');

        /* Notification is disabled for messages to Admin to avoid polluting the bell notification list
        // Create and send notifications to each admin
        for (const admin of admins) {
          console.log('📧 Creating notification for admin:', admin._id);

          const notificationTitle = 'Nouveau message de support';
          const notificationMsg = `Vous avez reçu un nouveau message: ${message}`;
          const notificationType = NotificationType.MESSAGE_ADMIN;
          const notificationData = {
            messageId: createMessage._id,
            chatId: idChat,
            senderId: sender,
            messageContent: message,
            createdAt: date,
            isSocket: true // Mark as socket message for frontend handling
          };

          const notification = await this.notificationService.create(
            admin._id.toString(),
            notificationType,
            notificationTitle,
            notificationMsg,
            notificationData,
            sender // senderId
          );

          // Send notification via socket to this admin
          this.MessageSocket.sendNotificationToUser(admin._id.toString(), notification);
          console.log('✅ Notification sent to admin:', admin._id);
        }
        */
        console.log('✅ Message sent to all admins (notification skipped)');
        console.log('✅ Message and notifications sent to all admins');
      } catch (error) {
        console.error('❌ Error sending message to admins:', error);
      }
    } else if (isSenderAdmin) {
      // Admin is sending message to user - send to specific user
      try {
        console.log('📨 Admin sending message to user:', reciver);

        // Send message via socket to user (including attachment data)
        this.MessageSocket.sendMessageFromAdminToUser('admin', reciver, message, idChat, createMessage._id, createMessage.attachment);
        console.log('📡 Backend emitted adminMessage and sendMessage events to user:', reciver);

        /* Notification is disabled for Admin messages to avoid polluting the bell notification list
        // Create notification for the user
        const notificationTitle = 'Nouveau message de l\'admin';
        const notificationMessage = message.includes('📎')
          ? 'L\'admin vous a envoyé une pièce jointe.'
          : `L'admin vous a envoyé un message : ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`;

        const notificationType = NotificationType.MESSAGE_RECEIVED;
        /*
        const notificationData = {
          messageId: createMessage._id,
          chatId: idChat,
          senderId: sender,
          messageContent: message,
          createdAt: date,
          isSocket: true // Mark as socket message for frontend handling
        };

        const notification = await this.notificationService.create(
          reciver,
          notificationType,
          notificationTitle,
          notificationMessage,
          notificationData,
          sender // senderId
        );

        // Send notification via socket to user
        this.MessageSocket.sendNotificationToUser(reciver, notification);
        */
        console.log('✅ Message sent to user (notification skipped):', reciver);

        // Notify all admins about the sent message
        try {
          const admins = await this.userService.findUsersByRoles([RoleCode.ADMIN]);
          console.log('📨 Notifying all admins about sent message:', admins.length);

          for (const admin of admins) {
            this.MessageSocket.sendNotificationToUser(admin._id.toString(), {
              type: 'ADMIN_MESSAGE_SENT',
              message: `Message sent to user ${reciver}: ${message}`,
              timestamp: date,
              messageId: createMessage._id,
              chatId: idChat
            });
          }
        } catch (err) {
          console.error('❌ Error notifying admins about sent message:', err);
        }
      } catch (error) {
        console.error('❌ Error sending message to user:', error);
      }
    } else {
      // Regular message sending between users (Buyer to Seller)
      console.log('📨 Sending regular message between users (Buyer to Seller)');

      // Send message via socket to both users
      this.MessageSocket.sendMessageToUser(sender, reciver, message, idChat, createMessage._id);
      console.log('✅ Socket message sent to users');

      // Send real-time update to chat room
      this.MessageSocket.sendRealtimeMessageUpdate(idChat, {
        messageId: createMessage._id,
        sender,
        reciver,
        message,
        chatId: idChat,
        createdAt: date,
        isSocket: true
      });


      /* Notifications are disabled for regular messages to avoid polluting the bell notification list
      // Create notification for the receiver (Seller)
      const notificationTitle = 'Nouveau message';
      const notificationMsg = `Vous avez reçu un nouveau message: ${message}`;
      const notificationType = NotificationType.MESSAGE_RECEIVED;
      const notificationData = {
        messageId: createMessage._id,
        chatId: idChat,
        senderId: sender,
        messageContent: message,
        createdAt: date,
        isSocket: true // Mark as socket message for frontend handling
      };

      try {
        // Create notification in database for the receiver
        const notification = await this.notificationService.create(
          reciver,
          notificationType,
          notificationTitle,
          notificationMsg,
          notificationData,
          sender // senderId
        );

        // Send notification via socket to receiver
        this.MessageSocket.sendNotificationToUser(reciver, notification);
        console.log('✅ Message notification created and sent to receiver:', reciver);

        // Also send a confirmation notification to the sender (Buyer)
        const senderNotificationTitle = 'Message envoyé';
        const senderNotificationMsg = `Votre message a été envoyé: ${message}`;
        const senderNotificationData = {
          messageId: createMessage._id,
          chatId: idChat,
          reciverId: reciver,
          messageContent: message,
          createdAt: date,
          isSocket: true
        };

        const senderNotification = await this.notificationService.create(
          sender,
          NotificationType.MESSAGE_RECEIVED, // Using same type for consistency
          senderNotificationTitle,
          senderNotificationMsg,
          senderNotificationData,
          reciver // senderId (display receiver name for sent messages)
        );

        // Send confirmation notification via socket to sender
        this.MessageSocket.sendNotificationToUser(sender, senderNotification);
        console.log('✅ Message confirmation notification sent to sender:', sender);

      } catch (error) {
        console.error('❌ Error creating/sending message notifications:', error);
      }
      */
      console.log('✅ Message sent between users (notification skipped)');
    }

    return createMessage;
  }

  async getAll(idChat: string): Promise<Message[]> {
    console.log('📥 Getting all messages for chat:', idChat);

    const getChats = await this.MessageModel.find({ idChat }).lean();
    console.log('📨 Messages found:', getChats.length);

    // Process messages to ensure attachment URLs are absolute
    const processedMessages = getChats.map(msg => {
      if (msg.attachment && msg.attachment.url) {
        // Convert relative URLs to absolute URLs
        if (msg.attachment.url.startsWith('/static/')) {
          // msg.attachment.url = `${process.env.API_BASE_URL || 'http://localhost:3000'}${msg.attachment.url}`;
          msg.attachment.url = `${resolveApiBaseUrl()}${msg.attachment.url}`;
        }
        console.log('📎 Processed attachment URL:', msg.attachment.url);
      }
      return msg;
    });

    // Log message with attachments
    const messagesWithAttachments = processedMessages.filter(msg => msg.attachment);
    if (messagesWithAttachments.length > 0) {
      console.log('📎 Messages with attachments:', messagesWithAttachments.length);
      messagesWithAttachments.forEach(msg => {
        console.log('📎 Attachment data:', {
          messageId: msg._id,
          messagePreview: msg.message.substring(0, 30),
          attachment: msg.attachment
        });
      });
    }

    return processedMessages;
  }

  async deleteOne(id: string): Promise<Message> {
    const deleted = await this.MessageModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException(`this message with this id ${id} is not found`)
    }
    return deleted;
  }

  async deleteAll(): Promise<void> {
    const deleted = await this.MessageModel.deleteMany({});
    return;
  }

  async markAllAsRead(chatId: string): Promise<{ modifiedCount: number }> {
    console.log('🔖 Marking all messages as read for chat:', chatId);
    const result = await this.MessageModel.updateMany(
      { idChat: chatId, isRead: false },
      { isRead: true, updatedAt: new Date() }
    ).exec();

    console.log('📊 Marked as read result:', result);

    // Emit socket event to notify clients that messages were marked as read
    this.MessageSocket.sendMessageReadStatus(chatId, {
      modifiedCount: result.modifiedCount,
      timestamp: new Date().toISOString()
    });

    return { modifiedCount: result.modifiedCount };
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    console.log('🔢 Getting unread message count for user:', userId);
    try {
      const count = await this.MessageModel.countDocuments({
        reciver: userId,
        isRead: false
      }).exec();

      console.log('📊 Unread message count:', count);
      return { count };
    } catch (error) {
      console.error('Error getting unread count:', error);
      throw error;
    }
  }

  async markChatAsRead(chatId: string, userId: string): Promise<{ messageCount: number; notificationCount: number }> {
    console.log('🔖 Marking chat as read for user:', userId, 'chatId:', chatId);

    try {
      // Mark all messages in this chat as read for this user
      const messageResult = await this.MessageModel.updateMany(
        {
          idChat: chatId,
          reciver: userId,
          isRead: false
        },
        {
          isRead: true,
          updatedAt: new Date()
        }
      ).exec();

      console.log('📊 Marked messages as read:', messageResult.modifiedCount);

      // Mark all notifications related to this chat as read for this user
      const notificationResult = await this.notificationService.markAllChatNotificationsAsRead(userId, chatId);

      console.log('📊 Marked notifications as read:', notificationResult.modifiedCount);

      return {
        messageCount: messageResult.modifiedCount,
        notificationCount: notificationResult.modifiedCount
      };
    } catch (error) {
      console.error('Error marking chat as read:', error);
      throw error;
    }
  }

  async getUnreadMessages(userId: string): Promise<Message[]> {
    console.log('🔍 Getting unread messages for user:', userId);
    try {
      const messages = await this.MessageModel.find({
        reciver: userId,
        isRead: false
      }).sort({ createdAt: -1 }).exec();

      console.log('📊 Found unread messages:', messages.length);
      return messages;
    } catch (error) {
      console.error('Error getting unread messages:', error);
      throw error;
    }
  }

  async getChatOverview(chatIds: string[], userId?: string | string[]): Promise<{ lastMessageMap: Map<string, Message>, unreadCountMap: Map<string, number> }> {
    const uniqueChatIds = [...new Set(chatIds)];

    // 1. Get last message for each chat
    const lastMessages = await this.MessageModel.aggregate([
      { $match: { idChat: { $in: uniqueChatIds } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$idChat',
          lastMessage: { $first: '$$ROOT' }
        }
      }
    ]).exec();

    // 2. Get unread count for each chat (for specific user if provided)
    const matchStage: any = { idChat: { $in: uniqueChatIds }, isRead: false };
    if (userId) {
      if (Array.isArray(userId)) {
        matchStage.reciver = { $in: userId };
      } else {
        matchStage.reciver = userId;
      }
    }

    const unreadCounts = await this.MessageModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$idChat',
          count: { $sum: 1 }
        }
      }
    ]).exec();

    // Convert arrays to Maps
    const lastMessageMap = new Map<string, Message>();
    if (Array.isArray(lastMessages)) {
      lastMessages.forEach(item => lastMessageMap.set(item._id, item.lastMessage));
    }

    const unreadCountMap = new Map<string, number>();
    if (Array.isArray(unreadCounts)) {
      unreadCounts.forEach(item => unreadCountMap.set(item._id, item.count));
    }

    return { lastMessageMap, unreadCountMap };
  }
}