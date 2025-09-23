import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument, NotificationType } from './schema/notification.schema';
import { SocketGateway } from '../../socket/socket.gateway';

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    private readonly NotificationGateway: SocketGateway,
  ) {}

  async create(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: any,
  ): Promise<Notification> {
    const notification = new this.notificationModel({
      userId,
      type,
      title,
      message,
      data,
      read: false,
    });

    await notification.save();
    

    // Send notification to specific user via socket
    this.NotificationGateway.sendNotificationToUser(userId, {

      _id: notification._id,
      userId,
      type,
      title,
      message,
      data,
      read: false,
      createdAt: notification.createdAt,
    });

    
    return notification;
  }

  async findForBuyer(userId: string): Promise<Notification[]> {
    console.log('Fetching notifications for buyer userId:', userId);
    console.log('User ID type:', typeof userId);
    try {
      const notifications = await this.notificationModel
        .find({ 
          userId,
          type: { 
            $in: [
              NotificationType.AUCTION_WON,
              NotificationType.AUCTION_LOST,
              NotificationType.AUCTION_ENDING_SOON,
              NotificationType.BID_OUTBID,
              NotificationType.PAYMENT_PENDING,
              NotificationType.CHAT_CREATED,  // Added chat notifications for buyers too
              NotificationType.MESSAGE_RECEIVED  // Added message notifications for buyers
            ] 
          }
        })
        .sort({ createdAt: -1 })
        .exec();

      console.log('Found notifications for buyer:', notifications.length);
      console.log('Notification user IDs:', notifications.map(n => ({ id: n._id, userId: n.userId, title: n.title })));
      return notifications;
    } catch (error) {
      console.error('Error finding notifications for buyer:', error);
      throw error;
    }
  }

  async findForUser(userId: string): Promise<Notification[]> {
    console.log('Fetching all notifications for userId:', userId);
    try {
      const notifications = await this.notificationModel
        .find({ userId })
        .sort({ createdAt: -1 })
        .exec();

      console.log('Found notifications:', notifications.length);
      return notifications;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  }

  async findForSeller(userId: string): Promise<Notification[]> {
    console.log('Fetching notifications for seller userId:', userId);
    console.log('User ID type:', typeof userId);
    try {
      // TEMPORARILY: Return ALL notifications for the user to see what's in the database
      console.log('🔍 DEBUG: Temporarily returning ALL notifications for user to debug');
      
      const allUserNotifications = await this.notificationModel
        .find({ userId })
        .sort({ createdAt: -1 })
        .exec();
      
      console.log('🔍 DEBUG: All notifications for user (no type filter):', allUserNotifications.length);
      console.log('🔍 DEBUG: All notification types for user:', allUserNotifications.map(n => n.type));
      console.log('🔍 DEBUG: All notification titles:', allUserNotifications.map(n => n.title));
      console.log('🔍 DEBUG: All notification user IDs:', allUserNotifications.map(n => n.userId));
      
      // Return all notifications temporarily for debugging
      return allUserNotifications;
      
      // Original filtered query (commented out for debugging)
      /*
      const query = { 
        userId,
        type: { 
          $in: [
            NotificationType.BID_ENDED,
            NotificationType.BID_WON,
            NotificationType.ITEM_SOLD,
            NotificationType.CHAT_CREATED,  // Added CHAT_CREATED for chat notifications
            NotificationType.MESSAGE_RECEIVED  // Added message notifications for sellers
          ] 
        }
      };
      
      console.log('🔍 DEBUG: Database query:', JSON.stringify(query, null, 2));
      
      const notifications = await this.notificationModel
        .find(query)
        .sort({ createdAt: -1 })
        .exec();

      console.log('Found notifications for seller:', notifications.length);
      console.log('Notification user IDs:', notifications.map(n => ({ id: n._id, userId: n.userId, title: n.title, read: n.read })));
      
      return notifications;
      */
    } catch (error) {
      console.error('Error finding notifications for seller:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Notification | null> {
    try {
      return await this.notificationModel.findById(id).exec();
    } catch (error) {
      console.error('Error finding notification by ID:', error);
      return null;
    }
  }

  async markAsRead(id: string): Promise<Notification> {
    console.log('🔖 Marking notification as read in service:', id);
    return this.notificationModel.findByIdAndUpdate(
      id,
      { read: true, updatedAt: new Date() },
      { new: true }
    ).exec();
  }

  async markAllAsRead(userId: string): Promise<{ modifiedCount: number }> {
    console.log('🔖 Marking all notifications as read for user:', userId);
    const result = await this.notificationModel.updateMany(
      { userId, read: false },
      { read: true, updatedAt: new Date() }
    ).exec();
    
    console.log('📊 Marked as read result:', result);
    return { modifiedCount: result.modifiedCount };
  }

  async getUnreadCount(userId: string): Promise<number> {
    console.log('🔢 Getting unread count for user:', userId);
    try {
      const count = await this.notificationModel.countDocuments({ 
        userId, 
        read: false  // Only count unread notifications
      }).exec();
      
      console.log('📊 Unread notification count:', count);
      return count;
    } catch (error) {
      console.error('Error getting unread count:', error);
      throw error;
    }
  }

  async findAllNotifications(): Promise<Notification[]> {
    return this.notificationModel.find().sort({ createdAt: -1 }).exec();
  }

  async markAllChatNotificationsAsRead(userId: string, chatId: string): Promise<{ modifiedCount: number }> {
    console.log('🔖 Marking all notifications as read for user:', userId, 'and chatId:', chatId);
    const result = await this.notificationModel.updateMany(
      { userId, read: false, 'data.chatId': chatId },
      { read: true, updatedAt: new Date() }
    ).exec();
    console.log('📊 Marked as read result for chat:', result);
    return { modifiedCount: result.modifiedCount };
  }
}