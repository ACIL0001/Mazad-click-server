import { Injectable } from "@nestjs/common";
import { WebSocketGateway, SubscribeMessage, MessageBody, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from "@nestjs/websockets";
import { JwtService } from "@nestjs/jwt";
import { Server, Socket } from 'socket.io';

interface IOnlineUser {
  userId: string;
  socketIds: string[];
}

export interface MessagePayload {
  message: string;
  reciver: string;
  idChat: string;
  sender: string;
  _id: string;
  createdAt: string;
  isSocket?: boolean;
  attachment?: any;
}

export interface NotificationPayload {
  message: string;
  reciver: string;
  idChat: string;
  sender: string;
  attachment?: any;
}
import { getApiBaseUrl } from '../common/utils';

@WebSocketGateway({
  cors: {
    origin: [
      /^https?:\/\/(localhost|127\.0\.0\.1):30\d{2}$/,
      /^https:\/\/mazad-click-(buyer|seller|backoffice|admin)(-[a-z0-9-]+)?\.vercel\.app$/,
      /^https:\/\/mazadclick\.vercel\.app\/?$/,
      /^https:\/\/mazadclick\.com\/?$/,
    ],
  },
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private onlineUsers: Map<string, IOnlineUser> = new Map();

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    // Strictly enforce auth payload token over URL query token for security
    let token = client.handshake.auth?.token as string;
    
    if (token && token.startsWith('Bearer ')) {
      token = token.split(' ')[1];
    }

    try {
      if (!token) {
        // Allow guest connections to stay open for guest chat
        const queryUserId = client.handshake.query.userId as string;
        if (queryUserId === 'guest' || queryUserId?.startsWith('guest')) {
          let user = this.onlineUsers.get(queryUserId);
          if (user) {
            if (!user.socketIds.includes(client.id)) {
              user.socketIds.push(client.id);
            }
          } else {
            this.onlineUsers.set(queryUserId, { userId: queryUserId, socketIds: [client.id] });
          }
          this.emitOnlineUsers();
          return;
        }

        // Silently disconnect if no token is provided to avoid log spam
        client.disconnect(true);
        return;
      }

      // Verify the JWT cryptographically
      const payload = await this.jwtService.verifyAsync(token);
      const userId = payload.sub as string;

      if (userId && userId !== 'undefined' && userId !== 'null') {
        let user = this.onlineUsers.get(userId);
        if (user) {
          if (!user.socketIds.includes(client.id)) {
            user.socketIds.push(client.id);
          }
        } else {
          this.onlineUsers.set(userId, { userId, socketIds: [client.id] });
        }
        this.emitOnlineUsers();
      } else {
        client.disconnect(true);
      }
    } catch (error) {
      if (error.message !== 'No token provided') {
        console.error('Socket Authentication Failed:', error.message);
      }
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    let disconnectedUser: IOnlineUser | undefined;
    for (const [userId, user] of this.onlineUsers.entries()) {
      if (user.socketIds.includes(client.id)) {
        disconnectedUser = user;
        const remainingSockets = user.socketIds.filter((id) => id !== client.id);
        if (remainingSockets.length > 0) {
          this.onlineUsers.set(userId, { ...user, socketIds: remainingSockets });
        } else {
          this.onlineUsers.delete(userId);
        }
        break; // Assuming one user per socket ID
      }
    }
    // Only log in development mode
    this.emitOnlineUsers();
  }

  sendMessageToUser(sender: string, userId: string, message: string, idChat: string, idMes: string): void {
    // Only log in development mode
    const recipient = this.onlineUsers.get(userId);
    const senderUser = this.onlineUsers.get(sender);
    const now = new Date().toISOString();

    // Prepare message payload
    const messagePayload = {
      message,
      reciver: userId,
      idChat,
      sender,
      _id: idMes,
      createdAt: now,
      isSocket: true // Mark as socket message
    };

    if (recipient) {
      // Send to all recipient sockets
      recipient.socketIds.forEach(socketId => {
        // Send the actual message
        this.server.to(socketId).emit('sendMessage', messagePayload);

        // Emit newMessage for notification system
        this.server.to(socketId).emit('newMessage', {
          message,
          reciver: userId,
          idChat,
          sender,
          messageId: idMes,
          createdAt: now
        });

        // Emit messageReceived for real-time updates
        this.server.to(socketId).emit('messageReceived', {
          message,
          sender,
          chatId: idChat,
          messageId: idMes,
          timestamp: now
        });

        // Emit buyerToSellerMessage for specific buyer-seller communication
        this.server.to(socketId).emit('buyerToSellerMessage', {
          message,
          sender,
          reciver: userId,
          chatId: idChat,
          messageId: idMes,
          timestamp: now,
          isSocket: true
        });
      });
    } else {
      // Only log in development mode
    }

    if (senderUser) {
      // Send confirmation to sender
      senderUser.socketIds.forEach(socketId => {
        this.server.to(socketId).emit('sendMessage', messagePayload);

        // Emit messageSent confirmation
        this.server.to(socketId).emit('messageSent', {
          message,
          reciver: userId,
          chatId: idChat,
          messageId: idMes,
          timestamp: now,
          status: recipient ? 'delivered' : 'pending'
        });

        // Emit buyerMessageSent for buyer confirmation
        this.server.to(socketId).emit('buyerMessageSent', {
          message,
          reciver: userId,
          chatId: idChat,
          messageId: idMes,
          timestamp: now,
          status: recipient ? 'delivered' : 'pending'
        });
      });
    }

    // Also broadcast to chat room for real-time updates
    this.server.to(`chat_${idChat}`).emit('chatMessageUpdate', {
      message,
      sender,
      reciver: userId,
      chatId: idChat,
      messageId: idMes,
      timestamp: now,
      isSocket: true
    });
  }

  sendMessageToAllAdmins(sender: string, adminIds: string[], message: string, idChat: string, idMes: string, attachment?: any): void {
    const senderUser = this.onlineUsers.get(sender);
    const now = new Date().toISOString();

    // Full message payload (with _id so frontend deduplication works)
    const messagePayload: MessagePayload = {
      message,
      reciver: 'admin',
      idChat,
      sender,
      _id: idMes,
      createdAt: now
    };

    if (attachment) {
      if (attachment.url && attachment.url.startsWith('/static/')) {
        attachment.url = `${getApiBaseUrl()}${attachment.url}`;
      }
      messagePayload.attachment = attachment;
    }

    // 1. Send confirmation back to the sender (user who sent the message)
    if (senderUser) {
      senderUser.socketIds.forEach(socketId => {
        this.server.to(socketId).emit('sendMessage', messagePayload);
      });
    }

    // 2. Send to each known admin by their real user ID in onlineUsers
    adminIds.forEach(adminId => {
      const adminUser = this.onlineUsers.get(adminId);
      if (adminUser) {
        adminUser.socketIds.forEach(socketId => {
          // Skip if this socket already got the message as sender
          if (senderUser && senderUser.socketIds.includes(socketId)) return;
          this.server.to(socketId).emit('sendMessage', messagePayload);
        });
      }
    });

    // 3. CRITICAL FIX: Also broadcast to the chat room so that any admin
    //    who called joinChat receives the message via chatMessageUpdate.
    //    This is the reliable fallback when onlineUsers lookup returns nothing.
    this.server.to(`chat_${idChat}`).emit('chatMessageUpdate', {
      _id: idMes,
      messageId: idMes,
      message,
      sender,
      reciver: 'admin',
      idChat,
      chatId: idChat,
      createdAt: now,
      attachment: messagePayload.attachment,
      isSocket: true
    });
  }

  sendMessageFromAdminToUser(adminId: string, userId: string, message: string, idChat: string, idMes: string, attachment?: any): void {
    // For admin messages, adminId is 'admin' string, not actual admin user ID
    // So we don't need to find admin in online users, just send to recipient
    const recipientUser = this.onlineUsers.get(userId);
    const now = new Date().toISOString();



    // Prepare message payload
    const messagePayload: MessagePayload = {
      message,
      reciver: userId,
      idChat,
      sender: 'admin',
      _id: idMes,
      createdAt: now
    };

    // Add attachment if present
    if (attachment) {
      // Ensure attachment URL is absolute
      if (attachment.url && attachment.url.startsWith('/static/')) {
        attachment.url = `${getApiBaseUrl()}${attachment.url}`;
      }
      messagePayload.attachment = attachment;
    }

    // Send to recipient user if online
    if (recipientUser) {
      recipientUser.socketIds.forEach(socketId => {
        // 1. Emit adminMessage specifically for admin chat - HIGHEST PRIORITY
        // This is the most reliable way to ensure messages are delivered to the client
        this.server.to(socketId).emit('adminMessage', messagePayload);
        // 2. Also emit sendMessage for backward compatibility - COMMENTED OUT TO PREVENT DUPLICATES
        // this.server.to(socketId).emit('sendMessage', messagePayload);
        // ^ This was commented out, now I am confirming it should STAY commented out or removed.
        // If I remove it, Clients listening to 'sendMessage' won't get it.
        // But Buyer listens to 'adminMessage'. So it's fine.

        // 3. Also emit newMessage for notification system
        const notificationPayload: NotificationPayload = {
          message,
          reciver: userId,
          idChat,
          sender: 'admin'
        };
        if (attachment) {
          // Ensure attachment URL is absolute
          const attachmentCopy = { ...attachment };
          if (attachmentCopy.url && attachmentCopy.url.startsWith('/static/')) {
            attachmentCopy.url = `${getApiBaseUrl()}${attachmentCopy.url}`;
          }
          notificationPayload.attachment = attachmentCopy;
        }
        this.server.to(socketId).emit('newMessage', notificationPayload);

        // 4. Log success for debugging
      });
    } else {
      // For guest users, broadcast to all sockets since they might not be in onlineUsers
      // if (userId === 'guest') {
      //   console.log('📤 Broadcasting admin message to all sockets for guest user');
      //   this.server.emit('adminMessage', messagePayload); 
      //   // this.server.emit('sendMessage', messagePayload); // REDUNDANT
      //   // this.server.emit('newMessage', ...);
      //   console.log('✅ Admin message broadcasted to all sockets for guest');
      // } else {
      //   console.log('⚠️ Message will be delivered when user comes online');

      //   // Broadcast the message to all sockets to increase chances of delivery
      //   console.log('📤 Broadcasting admin message to all sockets as fallback');
      //   this.server.emit('adminMessage', messagePayload);
      //   // this.server.emit('sendMessage', messagePayload); // REDUNDANT
      //   // this.server.emit('newMessage', ...);
      // }
    }

    // Also broadcast to all admin sockets to ensure all admin interfaces are updated
    this.onlineUsers.forEach(user => {
      // Find users that might be admins
      const isAdminUser = user.userId.includes('admin');
      if (isAdminUser) {
        user.socketIds.forEach(socketId => {
          // Send a notification that the message was sent
          this.server.to(socketId).emit('admin-message-sent', {
            message,
            reciver: userId,
            idChat,
            sender: 'admin',
            _id: idMes,
            createdAt: now,
            status: recipientUser ? 'delivered' : 'pending'
          });
        });
      }
    });

    // Also broadcast to chat room for real-time updates (fallback for joined devices/tabs)
    this.server.to(`chat_${idChat}`).emit('chatMessageUpdate', {
      _id: idMes,
      messageId: idMes,
      message,
      sender: 'admin',
      reciver: userId,
      idChat,
      chatId: idChat,
      createdAt: now,
      attachment,
      isSocket: true
    });
  }

  sendNotificationToClients(notification: any) {
    // Send to all clients (broadcast) - keeps existing functionality
    this.server.emit('notification', notification);
  }

  broadcastNewListing(type: 'tender' | 'auction' | 'directSale', item: any) {
    this.server.emit('newListingCreated', { type, item });
  }

  sendNotificationToUser(userId: string, notification: any) {

    const user = this.onlineUsers.get(userId);
    if (user) {

      user.socketIds.forEach(socketId => {
        this.server.to(socketId).emit('notification', notification);
      });
    } else {

    }
  }

  sendNotificationChatCreateToOne(userId: string) {
    const check = this.onlineUsers.get(userId);
    if (!check) return;
    check.socketIds.forEach(socketId => {
      this.server
        .to(socketId)
        .emit('sendNotificationChatCreate', { message: 'The Chat Is Create', code: '001' });
    });
  }

  emitOnlineUsers() {
    // Emit only userIds (not socketIds) for online users
    const users = Array.from(this.onlineUsers.values()).map(u => ({ userId: u.userId }));
    this.server.emit('online-users', users);
  }

  sendBidWonNotificationToUser(userId: string, notification: any) {
    const user = this.onlineUsers.get(userId);
    if (!user) return;
    user.socketIds.forEach(socketId => {
      this.server.to(socketId).emit('bidWonNotification', notification);
    });
  }

  sendAuctionSoldNotificationToUser(userId: string, notification: any) {
    const user = this.onlineUsers.get(userId);
    if (!user) return;
    user.socketIds.forEach(socketId => {
      this.server.to(socketId).emit('auctionSoldNotification', notification);
    });
  }

  sendNewChatToBuyer(userId: string, chatInfo: any) {
    const user = this.onlineUsers.get(userId);
    if (!user) return;
    user.socketIds.forEach(socketId => {
      this.server.to(socketId).emit('newChatCreatedForBuyer', chatInfo);
    });
  }

  sendNewChatToSeller(userId: string, chatInfo: any) {
    const user = this.onlineUsers.get(userId);
    if (!user) return;
    user.socketIds.forEach(socketId => {
      this.server.to(socketId).emit('newChatCreatedForSeller', chatInfo);
    });
  }

  // Test endpoint to verify socket communication
  @SubscribeMessage('test')
  handleTest(client: Socket, payload: any) {
    // Send a test response back to the client
    client.emit('testResponse', {
      message: 'Test response from server',
      timestamp: new Date().toISOString(),
      clientId: client.id
    });

    // Also broadcast to all connected clients
    this.server.emit('testBroadcast', {
      message: 'Test broadcast from server',
      timestamp: new Date().toISOString(),
      fromClient: client.id
    });
  }

  // Test endpoint specifically for admin message delivery
  @SubscribeMessage('testAdminMessage')
  handleTestAdminMessage(client: Socket, payload: any) {
console.log('🧪 Test admin message received:', payload);
    const { userId, message } = payload;

    if (userId && message) {


      // Test the admin message delivery
      this.sendMessageFromAdminToUser('admin', userId, message, 'test-chat-id', 'test-message-id');

      // Send confirmation back to the test client
      client.emit('testAdminMessageResponse', {
        message: 'Admin message test completed',
        timestamp: new Date().toISOString(),
        targetUser: userId
      });
    } else {
      client.emit('testAdminMessageResponse', {
        error: 'Missing userId or message in payload',
        timestamp: new Date().toISOString()
      });
    }
  }

  // New method to broadcast message to all users in a chat
  @SubscribeMessage('joinChat')
  handleJoinChat(client: Socket, payload: { chatId: string, userId: string }) {

    const { chatId, userId } = payload;

    // Join the chat room
    client.join(`chat_${chatId}`);


    // Notify other users in the chat that someone joined
    client.to(`chat_${chatId}`).emit('userJoinedChat', {
      userId,
      chatId,
      timestamp: new Date().toISOString()
    });

    // Send a confirmation to the user that they joined
    client.emit('chatJoined', {
      chatId,
      userId,
      timestamp: new Date().toISOString(),
      message: 'Successfully joined chat room'
    });
  }

  // New method to handle leaving a chat
  @SubscribeMessage('leaveChat')
  handleLeaveChat(client: Socket, payload: { chatId: string, userId: string }) {

    const { chatId, userId } = payload;

    // Leave the chat room
    client.leave(`chat_${chatId}`);


    // Notify other users in the chat that someone left
    client.to(`chat_${chatId}`).emit('userLeftChat', {
      userId,
      chatId,
      timestamp: new Date().toISOString()
    });
  }

  // New method to broadcast typing indicators
  @SubscribeMessage('typing')
  handleTyping(client: Socket, payload: { chatId: string, userId: string, isTyping: boolean }) {

    const { chatId, userId, isTyping } = payload;

    // Broadcast typing status to other users in the chat
    client.to(`chat_${chatId}`).emit('userTyping', {
      userId,
      chatId,
      isTyping,
      timestamp: new Date().toISOString()
    });
  }

  // New method to broadcast message read status
  @SubscribeMessage('markMessageAsRead')
  handleMarkMessageAsRead(client: Socket, payload: { messageId: string, chatId: string, userId: string }) {

    const { messageId, chatId, userId } = payload;

    // Broadcast read status to other users in the chat
    client.to(`chat_${chatId}`).emit('messageRead', {
      messageId,
      chatId,
      userId,
      timestamp: new Date().toISOString()
    });

    // Send confirmation to the user who marked it as read
    client.emit('messageReadConfirmation', {
      messageId,
      chatId,
      timestamp: new Date().toISOString()
    });
  }

  // Enhanced method to send real-time message updates
  sendRealtimeMessageUpdate(chatId: string, message: any) {


    // Send to all users in the chat room
    this.server.to(`chat_${chatId}`).emit('realtimeMessageUpdate', {
      message,
      chatId,
      timestamp: new Date().toISOString()
    });
  }

  // Method to notify clients when messages are marked as read
  sendMessageReadStatus(chatId: string, data: any) {


    // Send to all users in the chat room
    this.server.to(`chat_${chatId}`).emit('messagesMarkedAsRead', {
      chatId,
      ...data
    });

    // Also send to all admin users globally
    this.server.to('admin').emit('adminMessagesMarkedAsRead', {
      chatId,
      ...data
    });
  }

  // Method to get online users in a specific chat
  getOnlineUsersInChat(chatId: string): string[] {
    // This would need to be implemented based on your chat room management
    // For now, return all online users
    return Array.from(this.onlineUsers.values()).map(user => user.userId);
  }

  // Handle direct message sending from frontend
  @SubscribeMessage('sendMessage')
  handleSendMessage(client: Socket, payload: {
    sender: string,
    reciver: string,
    message: string,
    idChat: string
  }) {
console.log('📨 Direct message received from frontend:', payload);
    const { sender, reciver, message, idChat } = payload;

    // Generate a temporary message ID for socket delivery
    const tempMessageId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Send the message via socket immediately for real-time delivery
    this.sendMessageToUser(sender, reciver, message, idChat, tempMessageId);

    // Send confirmation back to sender
    client.emit('messageSentConfirmation', {
      messageId: tempMessageId,
      chatId: idChat,
      status: 'sent',
      timestamp: new Date().toISOString()
    });

console.log('✅ Direct message processed and sent via socket');
  }

  // ═══════════════════════════════════════════
  // ██  ANALYTICS REALTIME ENDPOINTS
  // ═══════════════════════════════════════════

  @SubscribeMessage('joinAnalytics')
  handleJoinAnalytics(client: Socket, payload: { userId: string, role: string }) {
    if (payload.role === 'admin' || payload.role === 'superadmin') {
      client.join('admin_analytics');
      client.emit('analyticsJoined', {
        status: 'success',
        timestamp: new Date().toISOString()
      });
    } else {
      client.emit('analyticsJoined', {
        status: 'forbidden',
        message: 'Only admins can join analytics room'
      });
    }
  }

  @SubscribeMessage('leaveAnalytics')
  handleLeaveAnalytics(client: Socket) {
    client.leave('admin_analytics');
  }

  broadcastAnalyticsUpdate(data: any) {
    this.server.to('admin_analytics').emit('analyticsRealtimeUpdate', data);
  }

}