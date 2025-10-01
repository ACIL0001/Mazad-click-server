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


@Injectable()
export class MessageService {
  constructor(
    @InjectModel(Message.name)
    private MessageModel: Model<MessageDocument>,
    private readonly MessageSocket: SocketGateway,
    private readonly notificationService: NotificationService,
    private readonly userService: UserService,
  ) {}

  async create(
    sender: string,
    reciver: string,
    message: string,
    idChat : string
  ): Promise<Message> {
    let date = new Date()
    const createMessage = new this.MessageModel({
      sender,
      reciver,
      message,
      idChat,
      createdAt : date,
      isRead: false,
    });
    
    // Save message to database first
    await createMessage.save();
    console.log('💾 Message saved to database:', { 
      messageId: createMessage._id, 
      sender, 
      reciver, 
      message, 
      idChat 
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
        
        // Send message via socket to all admins
        this.MessageSocket.sendMessageToAllAdmins(sender, message, idChat, createMessage._id);
        console.log('✅ Socket message sent to all admins');
        
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
            notificationData
          );
          
          // Send notification via socket to this admin
          this.MessageSocket.sendNotificationToUser(admin._id.toString(), notification);
          console.log('✅ Notification sent to admin:', admin._id);
        }
        console.log('✅ Message and notifications sent to all admins');
      } catch (error) {
        console.error('❌ Error sending message to admins:', error);
      }
    } else if (isSenderAdmin) {
      // Admin is sending message to user - send to specific user
      try {
        console.log('📨 Admin sending message to user:', reciver);
        
        // Send message via socket to user
        this.MessageSocket.sendMessageFromAdminToUser('admin', reciver, message, idChat, createMessage._id);
        console.log('📡 Backend emitted adminMessage and sendMessage events to user:', reciver);
        
        // Create notification for the user
        const notificationTitle = 'Nouveau message de l\'admin';
        const notificationMsg = `Vous avez reçu un nouveau message de l'équipe support: ${message}`;
        const notificationType = NotificationType.MESSAGE_RECEIVED;
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
          notificationMsg,
          notificationData
        );
        
        // Send notification via socket to user
        this.MessageSocket.sendNotificationToUser(reciver, notification);
        console.log('✅ Message and notification sent to user:', reciver);
        
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
          notificationData
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
          senderNotificationData
        );
        
        // Send confirmation notification via socket to sender
        this.MessageSocket.sendNotificationToUser(sender, senderNotification);
        console.log('✅ Message confirmation notification sent to sender:', sender);
        
      } catch (error) {
        console.error('❌ Error creating/sending message notifications:', error);
      }
    }
    
    return createMessage;
  }

  async getAll(idChat:string): Promise<Message[]> {
    console.log('Id' , idChat);
    
    const getChats =await this.MessageModel.find({idChat})
    console.log('jjf' , getChats);
    
    return getChats;
  }

  async deleteOne(id:string): Promise<Message> {
    const deleted = await this.MessageModel.findByIdAndDelete(id).exec();
     if(!deleted){
            throw new NotFoundException(`this message with this id ${id} is not found`)
        }
    return deleted;
  }

  async deleteAll(): Promise<void> {
        const deleted = await this.MessageModel.deleteMany({});
        return ;
  }

  async markAllAsRead(chatId: string): Promise<{ modifiedCount: number }> {
    console.log('🔖 Marking all messages as read for chat:', chatId);
    const result = await this.MessageModel.updateMany(
      { idChat: chatId, isRead: false },
      { isRead: true, updatedAt: new Date() }
    ).exec();
    
    console.log('📊 Marked as read result:', result);
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
}