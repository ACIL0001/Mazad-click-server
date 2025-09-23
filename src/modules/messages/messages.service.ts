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
     await createMessage.save();
      console.log('💬 New message created:', { sender, reciver, message, idChat });
      console.log('🔍 Message analysis:', {
        sender,
        reciver,
        isReciverAdmin: reciver === 'admin' || reciver === 'ADMIN',
        isSenderAdmin: sender === 'admin' || sender === 'ADMIN',
        messageLength: message.length
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
          
          // Use the new method to send to all admins
          this.MessageSocket.sendMessageToAllAdmins(sender, message, idChat, createMessage._id);
          console.log('✅ Socket message sent to all admins');
          
          for (const admin of admins) {
            console.log('📧 Creating notification for admin:', admin._id);
            // Create and send notification to each admin
            const notificationTitle = 'Nouveau message de support';
            const notificationMsg = `Vous avez reçu un nouveau message: ${message}`;
            const notificationType = NotificationType.MESSAGE_ADMIN;
            const notificationData = {
              messageId: createMessage._id,
              chatId: idChat,
              senderId: sender,
              messageContent: message,
              createdAt: date
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
          
          // CRITICAL FIX: Call the socket gateway to send message to user
          // This ensures the message is delivered via socket to the user
          this.MessageSocket.sendMessageFromAdminToUser('admin', reciver, message, idChat, createMessage._id);
          
          // Log socket message emission
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
            createdAt: date
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
          
          // Broadcast to all admins as well to ensure all admin interfaces are updated
          try {
            const admins = await this.userService.findUsersByRoles([RoleCode.ADMIN]);
            console.log('📨 Also notifying all admins about sent message:', admins.length);
            
            // Emit to all admin sockets
            for (const admin of admins) {
              this.MessageSocket.sendNotificationToUser(admin._id.toString(), {
                type: 'ADMIN_MESSAGE_SENT',
                message: `Message sent to user ${reciver}: ${message}`,
                timestamp: date
              });
            }
          } catch (err) {
            console.error('❌ Error notifying admins about sent message:', err);
          }
        } catch (error) {
          console.error('❌ Error sending message to user:', error);
        }
      } else {
        // Regular message sending (existing logic)
        this.MessageSocket.sendMessageToUser(sender, reciver, message, idChat, createMessage._id);
        
        // --- Notification logic for regular users ---
        const notificationTitle = 'Nouveau message';
        const notificationMsg = `Vous avez reçu un nouveau message: ${message}`;
        const notificationType = NotificationType.MESSAGE_RECEIVED;
        let notificationUserId = reciver;
        let notificationData = {
          messageId: createMessage._id,
          chatId: idChat,
          senderId: sender,
          messageContent: message,
          createdAt: date
        };

        try {
          // Create notification in DB
          const notification = await this.notificationService.create(
            notificationUserId,
            notificationType,
            notificationTitle,
            notificationMsg,
            notificationData
          );
          // Send notification via socket
          this.MessageSocket.sendNotificationToUser(reciver, notification);
          console.log('✅ Message notification created and sent:', notificationUserId);
        } catch (error) {
          console.error('❌ Error creating/sending message notification:', error);
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
}