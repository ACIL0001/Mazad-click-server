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
  constructor(private readonly notificationService: NotificationService) {}

  @Get('auction')
  @UseGuards(BuyerGuard)
  async findAuctionsForBuyer(@Req() req: ProtectedRequest) {
    console.log("Request received for notifications");
    if (!req.session?.user) {
      console.error("No user found in session");
      throw new UnauthorizedException('User not authenticated');
    }

    const userId = req.session.user._id.toString();
    console.log("User ID from session:", userId);

    try {
      // Get all notifications for the user (both auction and offer notifications)
      const notifications = await this.notificationService.findForUser(userId);
      console.log("Returning notifications to user");
      return notifications;
    } catch (error) {
      console.error("Error in findAllForBuyer:", error);
      throw error;
    }
  }

  @Get('buyer/:userId')
  async findNotificationsForBuyer(@Param('userId') userId: string) {
    console.log("Request received for buyer notifications, userId:", userId);
    try {
      const notifications = await this.notificationService.findForBuyer(userId);
      console.log("Returning notifications for buyer:", notifications.length);
      return notifications;
    } catch (error) {
      console.error("Error in findNotificationsForBuyer:", error);
      throw error;
    }
  }

  @Get('offer')
  @UseGuards(AuthGuard, SellerGuard)
  async findOffersForSeller(@Req() req: ProtectedRequest) {
    console.log("🔍 SELLER AUTH DEBUG:");
    console.log("Session exists:", !!req.session);
    console.log("User exists:", !!req.session?.user);
    console.log("User ID:", req.session?.user?._id);
    
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    console.log("Fetching notifications for seller with userId:", userId);
    
    const notifications = await this.notificationService.findForSeller(userId);
    console.log("🔍 DEBUG: Backend found notifications:", notifications.length);
    console.log("🔍 DEBUG: Backend notification types:", notifications.map(n => n.type));
    console.log("🔍 DEBUG: Backend notification user IDs:", notifications.map(n => n.userId));
    
    return notifications;
  }

  @Get()
  async findAllNotifications() {
    return this.notificationService.findAllNotifications();
  }

  // Debug endpoint to see all notifications in database
  @Get('debug/all')
  async debugAllNotifications() {
    console.log("🔍 DEBUG: Checking all notifications in database");
    const allNotifications = await this.notificationService.findAllNotifications();
    console.log("🔍 DEBUG: Total notifications in database:", allNotifications.length);
    console.log("🔍 DEBUG: Notification types:", allNotifications.map(n => n.type));
    console.log("🔍 DEBUG: User IDs:", allNotifications.map(n => n.userId));
    console.log("🔍 DEBUG: Titles:", allNotifications.map(n => n.title));
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
    console.log("🔖 Marking notification as read:", id);
    console.log("User:", req.session?.user?._id);
    
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    
    const userId = req.session.user._id.toString();
    
    // Verify the notification belongs to the user before marking as read
    const notification = await this.notificationService.findById(id);
    if (!notification) {
      throw new UnauthorizedException('Notification not found');
    }
    
    if (notification.userId !== userId) {
      throw new UnauthorizedException('You can only mark your own notifications as read');
    }
    
    const result = await this.notificationService.markAsRead(id);
    console.log("✅ Notification marked as read:", result);
    return result;
  }

  // Mark all notifications as read for sellers
  @Put('read-all')
  @UseGuards(AuthGuard, SellerGuard)
  async markAllAsRead(@Req() req: ProtectedRequest) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    console.log("🔖 Marking all notifications as read for seller:", userId);
    return this.notificationService.markAllAsRead(userId);
  }

  // Mark all notifications as read for buyers
  @Put('buyer/read-all')
  @UseGuards(AuthGuard)
  async markAllAsReadForBuyer(@Req() req: ProtectedRequest) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    console.log("🔖 Marking all notifications as read for buyer:", userId);
    return this.notificationService.markAllAsRead(userId);
  }

  // General read-all endpoint for both buyers and sellers
  @Put('read-all')
  @UseGuards(AuthGuard)
  async markAllAsReadGeneral(@Req() req: ProtectedRequest) {
    if (!req.session?.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = req.session.user._id.toString();
    console.log("🔖 Marking all notifications as read for user:", userId);
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
    console.log("Getting unread count for buyer with userId:", userId);
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
    console.log("Getting unread count for user:", userId);
    return this.notificationService.getUnreadCount(userId);
  }


  @Get('all')
  @UseGuards(BuyerGuard)
  async findAllForUser(@Req() req: ProtectedRequest) {
    console.log("Request received for all notifications");
    if (!req.session?.user) {
      console.error("No user found in session");
      throw new UnauthorizedException('User not authenticated');
    }

    const userId = req.session.user._id.toString();
    console.log("User ID from session:", userId);

    try {
      // Get all notifications for the user
      const notifications = await this.notificationService.findForUser(userId);
      console.log("Returning notifications to user:", notifications.length);
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
    console.log("POST request received for notifications");
    if (!req.session?.user) {
      console.error("No user found in session");
      throw new UnauthorizedException('User not authenticated');
    }

    const userId = req.session.user._id.toString();
    console.log("User ID from session:", userId);
    console.log("Request body:", body);

    try {
      // If body contains userId and token, it's a frontend request
      if (body.userId && body.token) {
        // This is a frontend request asking for notifications
        // Return notifications for the specified user
        const notifications = await this.notificationService.findForUser(body.userId);
        console.log("Returning notifications for user:", notifications.length);
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
        console.log("Notification created:", notification);
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
    console.log("🧪 Creating test notification for user:", userId);
    const notification = await this.notificationService.create(
      userId,
      NotificationType.NEW_OFFER,
      'Test Notification',
      body.message || 'This is a test notification to verify the system works!',
      { test: true }
    );
    console.log("✅ Test notification created:", notification);
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
    console.log("🧪 Creating test CHAT_CREATED notification for user:", userId);
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
    console.log("✅ Test CHAT_CREATED notification created:", notification);
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
    console.log('🔖 Marking all notifications as read for user:', userId, 'and chatId:', chatId);
    return this.notificationService.markAllChatNotificationsAsRead(userId, chatId);
  }
}