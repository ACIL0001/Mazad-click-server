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

    if (userId) {
      let user = this.onlineUsers.find((e) => e.userId === userId);
      if (user) {
        // Add new socketId if not already present
        if (!user.socketIds.includes(client.id)) {
          user.socketIds.push(client.id);
        }
      } else {
        this.onlineUsers.push({ userId, socketIds: [client.id] });
      }
      console.log('[SOCKET] handleConnection:', { userId, socketId: client.id });
      console.log('[SOCKET] Online Users after connect:', this.onlineUsers);
      this.emitOnlineUsers();
    } else {
      console.log('[SOCKET] handleConnection: No userId in handshake', { socketId: client.id });
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
    console.log('[SOCKET] handleDisconnect:', { socketId: client.id, user: disconnectedUser });
    console.log('[SOCKET] Online Users after disconnect:', this.onlineUsers);
    this.emitOnlineUsers();
  }

  sendMessageToUser(sender:string ,userId: string, message: string , idChat : string , idMes:string): void {
    console.log('📨 sendMessageToUser called:', { sender, userId, message, idChat, idMes });
    console.log("📨 Online users:", this.onlineUsers);
    
    const recipient = this.onlineUsers.find((e) => e.userId == userId);
    const senderUser = this.onlineUsers.find((e) => e.userId == sender);
    console.log('📨 Recipient:', recipient);
    console.log('📨 Sender:', senderUser);
    const now = new Date().toISOString(); 
    
    if (recipient) {
      // Send to all recipient sockets
      recipient.socketIds.forEach(socketId => {
        this.server.to(socketId).emit('sendMessage',{
           message , 
           reciver : userId ,
           idChat,
           sender , 
           _id:idMes ,
           createdAt : now
        });
        // Emit newMessage for notification system
        this.server.to(socketId).emit('newMessage',{
           message , 
           reciver : userId ,
           idChat,
           sender
        });
      });
    }
    
    if (senderUser) {
      senderUser.socketIds.forEach(socketId => {
        this.server.to(socketId).emit('sendMessage',{
           message , 
           reciver : userId ,
           idChat,
           sender , 
           _id:idMes ,
           createdAt : now
        });
      });
    }
  }

  sendMessageToAllAdmins(sender: string, message: string, idChat: string, idMes: string): void {
    console.log('📨 Sending message to all admins');
    console.log("📨 Online users:", this.onlineUsers);
    console.log("📨 Sender:", sender);
    console.log("📨 Message:", message);
    console.log("📨 Chat ID:", idChat);
    
    const senderUser = this.onlineUsers.find((e) => e.userId == sender);
    const now = new Date().toISOString();
    
    // Send to sender if they are online
    if (senderUser) {
      console.log('📤 Sending to sender:', sender);
      senderUser.socketIds.forEach(socketId => {
        this.server.to(socketId).emit('sendMessage', {
          message,
          reciver: 'admin',
          idChat,
          sender,
          _id: idMes,
          createdAt: now
        });
      });
    }
    
    // Send to all online users (admins will filter on frontend)
    console.log('📤 Broadcasting to all online users (admins will filter)');
    this.onlineUsers.forEach(user => {
      console.log('📤 Sending to user:', user.userId);
      user.socketIds.forEach(socketId => {
        this.server.to(socketId).emit('sendMessage', {
          message,
          reciver: 'admin',
          idChat,
          sender,
          _id: idMes,
          createdAt: now
        });
        
        // Also emit newMessage for notification system
        this.server.to(socketId).emit('newMessage', {
          message,
          reciver: 'admin',
          idChat,
          sender
        });
      });
    });
    console.log('✅ Message broadcasted to all online users');
  }

  sendMessageFromAdminToUser(adminId: string, userId: string, message: string, idChat: string, idMes: string): void {
    console.log('📨 Admin sending message to user:', { adminId, userId, message, idChat, idMes });
    console.log("📨 Online users:", this.onlineUsers);
    
    // For admin messages, adminId is 'admin' string, not actual admin user ID
    // So we don't need to find admin in online users, just send to recipient
    const recipientUser = this.onlineUsers.find((e) => e.userId == userId);
    const now = new Date().toISOString();
    
    console.log('📨 Recipient user:', recipientUser);
    
    // Prepare message payload
    const messagePayload = {
      message,
      reciver: userId,
      idChat,
      sender: 'admin',
      _id: idMes,
      createdAt: now
    };
    
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
        this.server.to(socketId).emit('newMessage', {
          message,
          reciver: userId,
          idChat,
          sender: 'admin'
        });
        
        // 4. Log success for debugging
        console.log('✅ Successfully emitted all message events to socket:', socketId);
      });
      console.log('✅ Admin message sent to user via socket');
    } else {
      console.log('📤 User not online:', userId);
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
}