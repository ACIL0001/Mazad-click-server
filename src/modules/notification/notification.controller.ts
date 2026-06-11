import { Controller, Get, Put, Param, UseGuards, Req, UnauthorizedException, Post, Body } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { BuyerGuard } from 'src/common/guards/reseller.guard';
import { ProtectedRequest } from 'src/types/request.type';
import { SellerGuard } from 'src/common/guards/client.guard';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { NotificationType } from './schema/notification.schema';

// DTOs for test notification endpoints
export class CreateTestNotificationDto {
  message?: string;
}

export class CreateTestChatNotificationDto {
  buyerName?: string;
  productTitle?: string;
}

@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) { }

  @Get('auction')
  @UseGuards(AuthGuard)
  async findAuctionsForBuyer(@Req() req: ProtectedRequest) {
    // console.log("Request received for notifications");
    if (!req.session?.user) {
      console.error("No user found in session");
      throw new UnauthorizedException('User not authenticated');
    }

    const userId = req.session.user._id.toString();
    // console.log("User ID from session:", userId);

    try {
      // Get all notifications for the user (both auction and offer notifications)
      const notifications = await this.notificationService.findForUser(userId);
      // console.log("Returning notifications to user");
      return notifications;
    } catch (error) {
      console.error("Error in findAllForBuyer:", error);
      throw error;
    }
  }

  @Get('buyer/:userId')
  async findNotificationsForBuyer(@Param('userId') userId: string) {
    // console.log("Request received for buyer notifications, userId:", userId);
    try {
      const notifications = await this.notificationService.findForBuyer(userId);
      // console.log("Returning notifications for buyer:", notifications.length);
      return notifications;
    } catch (error) {
      console.error("Error in findNotificationsForBuyer:", error);
      throw error;
    }
  }

  @Get('offer')
  @UseGuards(AuthGuard, SellerGuard)
  async findOffersForSeller(@Req() req: ProtectedRequest) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    const notifications = await this.notificationService.findForSeller(userId);
    return notifications;
  }

  @Get()
  @UseGuards(AuthGuard)
  async findAllNotifications(@Req() req: ProtectedRequest) {
    // For admin users, get all notifications
    // For regular users, get only their notifications
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }

    const userId = req.session.user._id.toString();
    const userType = req.session.user.type;
    // If admin or sous_admin, they should see their notifications
    // (notifications are created specifically for each admin)
    const notifications = await this.notificationService.findForUser(userId);

    // console.log('📧 Found notifications:', {
    //   count: notifications.length,
    //   unreadCount: notifications.filter(n => !n.read).length,
    //   types: notifications.map(n => n.type)
    // });

    return { data: notifications };
  }

  // Debug endpoint to see all notifications in database
  @Get('debug/all')
  async debugAllNotifications() {
    const allNotifications = await this.notificationService.findAllNotifications();
    return {
      total: allNotifications.length,
      notifications: allNotifications.map(n => ({
        id: n._id,
        userId: n.userId,
        type: n.type,
        title: n.title,
        read: n.read,
        createdAt: n.createdAt
      }))
    };
  }

  // Mark single notification as read - Works for both sellers and buyers
  @Put(':id/read')
  @UseGuards(AuthGuard)
  async markAsRead(@Param('id') id: string, @Req() req: ProtectedRequest) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }

    const userId = req.session.user._id.toString();

    // Verify the notification belongs to the user before marking as read
    const notification = await this.notificationService.findById(id);
    if (!notification) {
      console.error("❌ Notification not found:", id);
      throw new UnauthorizedException('Notification not found');
    }
    if (notification.userId !== userId) {
      console.error("❌ User trying to mark notification that doesn't belong to them:", {
        notificationUserId: notification.userId,
        currentUserId: userId
      });
      throw new UnauthorizedException('You can only mark your own notifications as read');
    }

    const result = await this.notificationService.markAsRead(id);
    return result;
  }

  // Mark all notifications as read for buyers
  @Put('buyer/read-all')
  @UseGuards(AuthGuard)
  async markAllAsReadForBuyer(@Req() req: ProtectedRequest) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    return this.notificationService.markAllAsRead(userId);
  }

  // General read-all endpoint for both buyers and sellers - FIXED: removed duplicate
  @Put('read-all')
  @UseGuards(AuthGuard)
  async markAllAsReadGeneral(@Req() req: ProtectedRequest) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    return this.notificationService.markAllAsRead(userId);
  }

  // Get unread count for buyers
  @Get('buyer/unread-count')
  @UseGuards(AuthGuard)
  async getUnreadCountForBuyer(@Req() req: ProtectedRequest) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    // console.log("Getting unread count for buyer with userId:", userId);
    return this.notificationService.getUnreadCount(userId);
  }

  // General unread-count endpoint for both buyers and sellers
  @Get('unread-count')
  @UseGuards(AuthGuard)
  async getUnreadCountGeneral(@Req() req: ProtectedRequest) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    // console.log("Getting unread count for user:", userId);
    return this.notificationService.getUnreadCount(userId);
  }


  @Get('all')
  @UseGuards(AuthGuard)
  async findAllForUser(@Req() req: ProtectedRequest) {
    // console.log("Request received for all notifications");
    if (!req.session?.user) {
      console.error("No user found in session");
      throw new UnauthorizedException('User not authenticated');
    }

    const userId = req.session.user._id.toString();
    // console.log("User ID from session:", userId);

    try {
      // Get all notifications for the user
      const notifications = await this.notificationService.findForUser(userId);
      // console.log("Returning notifications to user:", notifications.length);
      return { notifications };
    } catch (error) {
      console.error("Error in findAllForUser:", error);
      throw error;
    }
  }

  // POST endpoint for notifications (used by frontend)
  @Post()
  @UseGuards(AuthGuard)
  async createNotification(@Req() req: ProtectedRequest, @Body() body: any) {
    // console.log("POST request received for notifications");
    if (!req.session?.user) {
      console.error("No user found in session");
      throw new UnauthorizedException('User not authenticated');
    }

    const userId = req.session.user._id.toString();
    // console.log("User ID from session:", userId);
    // console.log("Request body:", body);

    try {
      // If body contains userId and token, it's a frontend request
      if (body.userId && body.token) {
        // This is a frontend request asking for notifications
        // Return notifications for the specified user
        const notifications = await this.notificationService.findForUser(body.userId);
        // console.log("Returning notifications for user:", notifications.length);
        return { notifications };
      } else {
        // This is a regular notification creation request
        const { type, title, message, data } = body;
        const notification = await this.notificationService.create(
          userId,
          type,
          title,
          message,
          data
        );
        // console.log("Notification created:", notification);
        return { success: true, notification };
      }
    } catch (error) {
      console.error("Error in createNotification:", error);
      throw error;
    }
  }

  // Test endpoint to create notifications for debugging
  @Post('test/create')
  @UseGuards(AuthGuard, SellerGuard)
  async createTestNotification(@Req() req: ProtectedRequest, @Body() body: CreateTestNotificationDto) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    const notification = await this.notificationService.create(
      userId,
      NotificationType.NEW_OFFER,
      'Test Notification',
      body.message || 'This is a test notification to verify the system works!',
      { test: true }
    );
    return { success: true, notification };
  }

  // Test endpoint to create CHAT_CREATED notifications specifically
  @Post('test/create-chat')
  @UseGuards(AuthGuard, SellerGuard)
  async createTestChatNotification(@Req() req: ProtectedRequest, @Body() body: CreateTestChatNotificationDto) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    const buyerName = body.buyerName || 'Test Buyer';
    const productTitle = body.productTitle || 'Test Product';
    const notification = await this.notificationService.create(
      userId,
      NotificationType.CHAT_CREATED,
      'Nouveau chat avec le gagnant',
      `Un nouveau chat a été créé avec l'acheteur ${buyerName} pour finaliser la vente de "${productTitle}".`,
      {
        test: true,
        chatId: 'test-chat-id',
        winnerName: buyerName,
        productTitle: productTitle
      }
    );
    return { success: true, notification };
  }

  // Mark all notifications for a specific chat as read for the authenticated user
  @Put('chat/:chatId/read')
  @UseGuards(AuthGuard)
  async markAllChatNotificationsAsRead(@Param('chatId') chatId: string, @Req() req: ProtectedRequest) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    return this.notificationService.markAllChatNotificationsAsRead(userId, chatId);
  }

  // Mark all chat notifications as read for the authenticated user
  @Put('chat/read-all')
  @UseGuards(AuthGuard)
  async markAllChatNotificationsAsReadForUser(@Req() req: ProtectedRequest) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    const result = await this.notificationService.markAllChatNotificationsAsReadForUser(userId);
    return result;
  }

  // New endpoint for general notifications with populated sender data
  @Get('general')
  @UseGuards(AuthGuard)
  async getGeneralNotifications(@Req() req: ProtectedRequest) {
    // console.log("GET /notification/general - Fetching general notifications");
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }

    const userId = req.session.user._id.toString();
    // console.log("User ID from session:", userId);

    try {
      const notifications = await this.notificationService.findGeneralNotificationsForUser(userId);
      // console.log("Returning general notifications:", notifications.length);
      return { notifications };
    } catch (error) {
      console.error("Error fetching general notifications:", error);
      throw error;
    }
  }

  // New endpoint for chat notifications with populated sender data
  @Get('chat')
  @UseGuards(AuthGuard)
  async getChatNotifications(@Req() req: ProtectedRequest) {
    // console.log("GET /notification/chat - Fetching chat notifications");
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }

    const userId = req.session.user._id.toString();
    // console.log("User ID from session:", userId);

    try {
      const notifications = await this.notificationService.findChatNotificationsForUser(userId);
      // console.log("Returning chat notifications:", notifications.length);
      return { notifications };
    } catch (error) {
      console.error("Error fetching chat notifications:", error);
      throw error;
    }
  }
}