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
    senderId?: string,
    senderName?: string,
    senderEmail?: string,
  ): Promise<Notification> {
    const notification = new this.notificationModel({
      userId,
      type,
      title,
      message,
      data,
      read: false,
      senderId,
      senderName,
      senderEmail,
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
      senderId,
      senderName,
      senderEmail,
      createdAt: notification.createdAt,
    });

    return notification;
  }

  async findForBuyer(userId: string): Promise<Notification[]> {
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
    try {
      const query = { 
        userId,
        type: { 
          $in: [
            NotificationType.BID_ENDED,
            NotificationType.BID_WON,
            NotificationType.ITEM_SOLD,
            NotificationType.CHAT_CREATED,
            NotificationType.MESSAGE_RECEIVED
          ] 
        }
      };
      
      const notifications = await this.notificationModel
        .find(query)
        .sort({ createdAt: -1 })
        .exec();
      
      return notifications;
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
    console.log('🔖 Service: Marking notification as read:', id);
    
    const result = await this.notificationModel.findByIdAndUpdate(
      id,
      { read: true, updatedAt: new Date() },
      { new: true }
    ).exec();
    
    if (result) {
      console.log('✅ Service: Notification marked as read successfully:', {
        id: result._id,
        read: result.read,
        updatedAt: result.updatedAt,
        type: result.type
      });
    } else {
      console.error('❌ Service: Failed to mark notification as read:', id);
    }
    
    return result;
  }

  async markAllAsRead(userId: string): Promise<{ modifiedCount: number }> {
    const result = await this.notificationModel.updateMany(
      { userId, read: false },
      { read: true, updatedAt: new Date() }
    ).exec();
    
    return { modifiedCount: result.modifiedCount };
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      const count = await this.notificationModel.countDocuments({ 
        userId, 
        read: false
      }).exec();
      
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

  async markAllChatNotificationsAsReadForUser(userId: string): Promise<{ modifiedCount: number }> {
    console.log('🔖 Marking all chat notifications as read for user:', userId);
    const result = await this.notificationModel.updateMany(
      { 
        userId, 
        read: false, 
        type: { 
          $in: [
            NotificationType.CHAT_CREATED,
            NotificationType.MESSAGE_RECEIVED
          ] 
        }
      },
      { read: true, updatedAt: new Date() }
    ).exec();
    console.log('📊 Marked as read result for all chat notifications:', result);
    return { modifiedCount: result.modifiedCount };
  }

  // New method to get general notifications with populated sender data
  async findGeneralNotificationsForUser(userId: string): Promise<Notification[]> {
    console.log('🔔 Fetching general notifications for user:', userId);
    console.log('🔔 User ID type:', typeof userId);
    
    try {
      // First, let's see all notifications for this user (for debugging)
      const allUserNotifications = await this.notificationModel
        .find({ userId })
        .sort({ createdAt: -1 })
        .exec();
      
      console.log('🔍 DEBUG: All notifications for user (no filters):', allUserNotifications.length);
      console.log('🔍 DEBUG: All notification types:', allUserNotifications.map(n => n.type));
      console.log('🔍 DEBUG: All notification titles:', allUserNotifications.map(n => n.title));
      console.log('🔍 DEBUG: All notification read status:', allUserNotifications.map(n => n.read));
      console.log('🔍 DEBUG: All notification user IDs:', allUserNotifications.map(n => n.userId));
      
      // Check specifically for offer notifications
      const offerNotifications = allUserNotifications.filter(n => 
        n.type === 'OFFER_ACCEPTED' || n.type === 'OFFER_DECLINED'
      );
      console.log('🔍 DEBUG: Offer notifications found:', offerNotifications.length);
      if (offerNotifications.length > 0) {
        console.log('🔍 DEBUG: Offer notifications details:', offerNotifications.map(n => ({
          id: n._id,
          title: n.title,
          type: n.type,
          read: n.read,
          userId: n.userId
        })));
      }
      
      const notifications = await this.notificationModel
        .find({ 
          userId,
          read: false, // Only unread notifications
          type: { 
            $nin: [
              NotificationType.CHAT_CREATED,
              NotificationType.MESSAGE_RECEIVED,
              NotificationType.MESSAGE_ADMIN
            ] 
          }
        })
        .populate('senderId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .exec();

      console.log('🔔 Found general notifications (filtered):', notifications.length);
      console.log('🔔 Filtered notification types:', notifications.map(n => n.type));
      console.log('🔔 Filtered notification titles:', notifications.map(n => n.title));
      
      // Add populated sender information to each notification
      const notificationsWithSender = notifications.map(notification => {
        const populatedNotification = notification.toObject() as any;
        
        console.log('🔍 Processing general notification:', populatedNotification._id);
        console.log('🔍 SenderId type:', typeof populatedNotification.senderId);
        console.log('🔍 SenderId value:', populatedNotification.senderId);
        
        // If senderId is populated, use that data
        if (populatedNotification.senderId && typeof populatedNotification.senderId === 'object' && populatedNotification.senderId.firstName && populatedNotification.senderId.lastName) {
          console.log('🔍 SenderId is populated object:', populatedNotification.senderId);
          populatedNotification.senderName = `${populatedNotification.senderId.firstName} ${populatedNotification.senderId.lastName}`;
          populatedNotification.senderEmail = populatedNotification.senderId.email || '';
          console.log('🔍 Generated senderName:', populatedNotification.senderName);
          console.log('🔍 Generated senderEmail:', populatedNotification.senderEmail);
        } else {
          console.log('🔍 SenderId is not populated or not an object');
          // Fallback to existing senderName if available
          if (!populatedNotification.senderName) {
            populatedNotification.senderName = 'Unknown User';
          }
        }
        
        return populatedNotification;
      });

      return notificationsWithSender;
    } catch (error) {
      console.error('Error fetching general notifications:', error);
      throw error;
    }
  }

  // New method to get chat notifications with populated sender data
  async findChatNotificationsForUser(userId: string): Promise<Notification[]> {
    console.log('💬 Fetching chat notifications for user:', userId);
    try {
      const notifications = await this.notificationModel
        .find({ 
          userId,
          read: false, // Only unread notifications
          type: { 
            $in: [
              NotificationType.CHAT_CREATED,
              NotificationType.MESSAGE_RECEIVED
            ] 
          }
        })
        .populate('senderId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .exec();

      console.log('💬 Found chat notifications:', notifications.length);
      
      // Add populated sender information to each notification
      const notificationsWithSender = notifications.map(notification => {
        const populatedNotification = notification.toObject() as any;
        
        console.log('🔍 Processing chat notification:', populatedNotification._id);
        console.log('🔍 SenderId type:', typeof populatedNotification.senderId);
        console.log('🔍 SenderId value:', populatedNotification.senderId);
        
        // If senderId is populated, use that data
        if (populatedNotification.senderId && typeof populatedNotification.senderId === 'object' && populatedNotification.senderId.firstName && populatedNotification.senderId.lastName) {
          console.log('🔍 SenderId is populated object:', populatedNotification.senderId);
          populatedNotification.senderName = `${populatedNotification.senderId.firstName} ${populatedNotification.senderId.lastName}`;
          populatedNotification.senderEmail = populatedNotification.senderId.email || '';
          console.log('🔍 Generated senderName:', populatedNotification.senderName);
          console.log('🔍 Generated senderEmail:', populatedNotification.senderEmail);
        } else {
          console.log('🔍 SenderId is not populated or not an object');
          // Fallback to existing senderName if available
          if (!populatedNotification.senderName) {
            populatedNotification.senderName = 'Unknown User';
          }
        }
        
        return populatedNotification;
      });

      return notificationsWithSender;
    } catch (error) {
      console.error('Error fetching chat notifications:', error);
      throw error;
    }
  }
}