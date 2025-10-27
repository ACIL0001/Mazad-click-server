import { Injectable } from "@nestjs/common";
import { WebSocketGateway , SubscribeMessage , MessageBody , WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from "@nestjs/websockets";
import { Server, Socket } from 'socket.io';

interface IOnlineUser {
  userId: string;
  socketIds: string[];
}


@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private onlineUsers: IOnlineUser[] = [];
  
  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;

    if (userId && userId !== 'undefined' && userId !== 'null') {
      let user = this.onlineUsers.find((e) => e.userId === userId);
      if (user) {
        // Add new socketId if not already present
        if (!user.socketIds.includes(client.id)) {
          user.socketIds.push(client.id);
        }
      } else {
        this.onlineUsers.push({ userId, socketIds: [client.id] });
      }
      // Only log in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log('[SOCKET] handleConnection:', { userId, socketId: client.id });
      }
      this.emitOnlineUsers();
    } else {
      // Disconnect clients without valid userId to prevent spam
      if (process.env.NODE_ENV === 'development') {
        console.log('[SOCKET] handleConnection: No valid userId in handshake, disconnecting', { socketId: client.id });
      }
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    let disconnectedUser: IOnlineUser | undefined;
    this.onlineUsers = this.onlineUsers.map((user) => {
      if (user.socketIds.includes(client.id)) {
        disconnectedUser = user;
        // Remove the socketId from the array
        return { ...user, socketIds: user.socketIds.filter((id) => id !== client.id) };
      }
      return user;
    }).filter((user) => user.socketIds.length > 0); // Only keep users with at least one socket
    // Only log in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log('[SOCKET] handleDisconnect:', { socketId: client.id, user: disconnectedUser });
    }
    this.emitOnlineUsers();
  }

  sendMessageToUser(sender:string ,userId: string, message: string , idChat : string , idMes:string): void {
    // Only log in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log('📨 sendMessageToUser called:', { sender, userId, message, idChat, idMes });
    }
    
    const recipient = this.onlineUsers.find((e) => e.userId == userId);
    const senderUser = this.onlineUsers.find((e) => e.userId == sender);
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
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ Recipient not online:', userId);
      }
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

  sendMessageToAllAdmins(sender: string, message: string, idChat: string, idMes: string, attachment?: any): void {
    console.log('📨 Sending message to all admins');
    console.log("📨 Online users:", this.onlineUsers);
    console.log("📨 Sender:", sender);
    console.log("📨 Message:", message);
    console.log("📨 Chat ID:", idChat);
    console.log("📎 Attachment:", attachment);
    
    const senderUser = this.onlineUsers.find((e) => e.userId == sender);
    const now = new Date().toISOString();
    
    // Prepare message payload
    const messagePayload: any = {
      message,
      reciver: 'admin',
      idChat,
      sender,
      _id: idMes,
      createdAt: now
    };
    
    // Add attachment if present
    if (attachment) {
      // Ensure attachment URL is absolute
      if (attachment.url && attachment.url.startsWith('/static/')) {
        attachment.url = `${process.env.API_BASE_URL || 'http://localhost:3000'}${attachment.url}`;
      }
      messagePayload.attachment = attachment;
      console.log('📎 Including attachment in socket message:', attachment);
    }
    
    // Send to sender if they are online
    if (senderUser) {
      console.log('📤 Sending to sender:', sender);
      senderUser.socketIds.forEach(socketId => {
        this.server.to(socketId).emit('sendMessage', messagePayload);
      });
    }
    
    // Send to all online users (admins will filter on frontend)
    console.log('📤 Broadcasting to all online users (admins will filter)');
    this.onlineUsers.forEach(user => {
      console.log('📤 Sending to user:', user.userId);
      user.socketIds.forEach(socketId => {
        this.server.to(socketId).emit('sendMessage', messagePayload);
        
        // Also emit newMessage for notification system
        const notificationPayload: any = {
          message,
          reciver: 'admin',
          idChat,
          sender
        };
        if (attachment) {
          // Ensure attachment URL is absolute
          const attachmentCopy = { ...attachment };
          if (attachmentCopy.url && attachmentCopy.url.startsWith('/static/')) {
            attachmentCopy.url = `${process.env.API_BASE_URL || 'http://localhost:3000'}${attachmentCopy.url}`;
          }
          notificationPayload.attachment = attachmentCopy;
        }
        this.server.to(socketId).emit('newMessage', notificationPayload);
      });
    });
    console.log('✅ Message broadcasted to all online users');
  }

  sendMessageFromAdminToUser(adminId: string, userId: string, message: string, idChat: string, idMes: string, attachment?: any): void {
    console.log('📨 Admin sending message to user:', { adminId, userId, message, idChat, idMes });
    console.log("📨 Online users:", this.onlineUsers);
    console.log("📎 Attachment:", attachment);
    
    // For admin messages, adminId is 'admin' string, not actual admin user ID
    // So we don't need to find admin in online users, just send to recipient
    const recipientUser = this.onlineUsers.find((e) => e.userId == userId);
    const now = new Date().toISOString();
    
    console.log('📨 Recipient user:', recipientUser);
    
    // Prepare message payload
    const messagePayload: any = {
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
        attachment.url = `${process.env.API_BASE_URL || 'http://localhost:3000'}${attachment.url}`;
      }
      messagePayload.attachment = attachment;
      console.log('📎 Including attachment in admin-to-user message:', attachment);
    }
    
    // Send to recipient user if online
    if (recipientUser) {
      console.log('📤 Sending to user:', userId);
      recipientUser.socketIds.forEach(socketId => {
        // 1. Emit adminMessage specifically for admin chat - HIGHEST PRIORITY
        // This is the most reliable way to ensure messages are delivered to the client
        this.server.to(socketId).emit('adminMessage', messagePayload);
        console.log('📤 Emitted adminMessage event to socket:', socketId);
        
        // 2. Also emit sendMessage for backward compatibility
        this.server.to(socketId).emit('sendMessage', messagePayload);
        
        // 3. Also emit newMessage for notification system
        const notificationPayload: any = {
          message,
          reciver: userId,
          idChat,
          sender: 'admin'
        };
        if (attachment) {
          // Ensure attachment URL is absolute
          const attachmentCopy = { ...attachment };
          if (attachmentCopy.url && attachmentCopy.url.startsWith('/static/')) {
            attachmentCopy.url = `${process.env.API_BASE_URL || 'http://localhost:3000'}${attachmentCopy.url}`;
          }
          notificationPayload.attachment = attachmentCopy;
        }
        this.server.to(socketId).emit('newMessage', notificationPayload);
        
        // 4. Log success for debugging
        console.log('✅ Successfully emitted all message events to socket:', socketId);
      });
      console.log('✅ Admin message sent to user via socket');
    } else {
      console.log('📤 User not online:', userId);
      
      // For guest users, broadcast to all sockets since they might not be in onlineUsers
      if (userId === 'guest') {
        console.log('📤 Broadcasting admin message to all sockets for guest user');
        this.server.emit('adminMessage', messagePayload);
        this.server.emit('sendMessage', messagePayload);
        this.server.emit('newMessage', {
          message,
          reciver: userId,
          idChat,
          sender: 'admin'
        });
        console.log('✅ Admin message broadcasted to all sockets for guest');
      } else {
        console.log('⚠️ Message will be delivered when user comes online');
        
        // Broadcast the message to all sockets to increase chances of delivery
        console.log('📤 Broadcasting admin message to all sockets as fallback');
        this.server.emit('adminMessage', messagePayload);
        this.server.emit('sendMessage', messagePayload);
        this.server.emit('newMessage', {
          message,
          reciver: userId,
          idChat,
          sender: 'admin'
        });
      }
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
    
    console.log('✅ Admin message processing completed');
  }

  sendNotificationToClients(notification: any) {
    // Send to all clients (broadcast) - keeps existing functionality
    this.server.emit('notification', notification);
  }

  sendNotificationToUser(userId: string, notification: any) {
    console.log('📧 sendNotificationToUser called:', { userId, notification });
    const user = this.onlineUsers.find((u) => u.userId === userId);
    if (user) {
      console.log('📧 User found online, sending notification to socketIds:', user.socketIds);
      user.socketIds.forEach(socketId => {
        this.server.to(socketId).emit('notification', notification);
      });
    } else {
      console.log('📧 User not online:', userId);
    }
  }

  sendNotificationChatCreateToOne(userId: string) {
    const check = this.onlineUsers.find((e) => e.userId == userId);
    if (!check) return;
    check.socketIds.forEach(socketId => {
      this.server
        .to(socketId)
        .emit('sendNotificationChatCreate', { message: 'The Chat Is Create' , code : '001'});
    });
  }

  emitOnlineUsers() {
    // Emit only userIds (not socketIds) for online users
    const users = this.onlineUsers.map(u => ({ userId: u.userId }));
    this.server.emit('online-users', users);
  }

  sendBidWonNotificationToUser(userId: string, notification: any) {
    const user = this.onlineUsers.find((e) => e.userId == userId);
    if (!user) return;
    user.socketIds.forEach(socketId => {
      this.server.to(socketId).emit('bidWonNotification', notification);
    });
  }

  sendAuctionSoldNotificationToUser(userId: string, notification: any) {
    const user = this.onlineUsers.find((e) => e.userId == userId);
    if (!user) return;
    user.socketIds.forEach(socketId => {
      this.server.to(socketId).emit('auctionSoldNotification', notification);
    });
  }

  sendNewChatToBuyer(userId: string, chatInfo: any) {
    const user = this.onlineUsers.find((e) => e.userId == userId);
    if (!user) return;
    user.socketIds.forEach(socketId => {
      this.server.to(socketId).emit('newChatCreatedForBuyer', chatInfo);
    });
  }

  sendNewChatToSeller(userId: string, chatInfo: any) {
    const user = this.onlineUsers.find((e) => e.userId == userId);
    if (!user) return;
    user.socketIds.forEach(socketId => {
      this.server.to(socketId).emit('newChatCreatedForSeller', chatInfo);
    });
  }

  // Test endpoint to verify socket communication
  @SubscribeMessage('test')
  handleTest(client: Socket, payload: any) {
    console.log('🧪 Test message received from client:', payload);
    console.log('🧪 Client ID:', client.id);
    console.log('🧪 Online users:', this.onlineUsers);
    
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
      console.log('🧪 Testing admin message delivery to user:', userId);
      
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
    console.log('📱 User joining chat:', payload);
    const { chatId, userId } = payload;
    
    // Join the chat room
    client.join(`chat_${chatId}`);
    console.log(`✅ User ${userId} joined chat room: chat_${chatId}`);
    
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
    console.log('📱 User leaving chat:', payload);
    const { chatId, userId } = payload;
    
    // Leave the chat room
    client.leave(`chat_${chatId}`);
    console.log(`✅ User ${userId} left chat room: chat_${chatId}`);
    
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
    console.log('⌨️ Typing indicator:', payload);
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
    console.log('👁️ Marking message as read:', payload);
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
    console.log('📡 Broadcasting real-time message update to chat:', chatId);
    
    // Send to all users in the chat room
    this.server.to(`chat_${chatId}`).emit('realtimeMessageUpdate', {
      message,
      chatId,
      timestamp: new Date().toISOString()
    });
  }

  // Method to notify clients when messages are marked as read
  sendMessageReadStatus(chatId: string, data: any) {
    console.log('👁️ Broadcasting message read status for chat:', chatId, data);
    
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
    return this.onlineUsers.map(user => user.userId);
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

}