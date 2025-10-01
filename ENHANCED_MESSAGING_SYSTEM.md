# Enhanced Messaging System Documentation

## Overview
This document describes the enhanced real-time messaging system that handles buyer-to-seller communication with socket.io, database storage, and push notifications.

## System Architecture

### Components
1. **Message Service** - Handles message creation and database storage
2. **Socket Gateway** - Manages real-time communication via WebSockets
3. **Notification Service** - Creates and sends push notifications
4. **Chat Service** - Manages chat rooms and user connections

## Message Flow

### 1. Message Creation Process
```
Buyer sends message → Message Service → Database Storage → Socket Events → Notifications
```

### 2. Detailed Flow
1. **Frontend** sends message via socket or HTTP API
2. **Message Service** saves message to MongoDB
3. **Socket Gateway** emits real-time events to users
4. **Notification Service** creates and sends notifications
5. **Database** stores message and notification records

## Socket Events

### Client → Server Events
- `joinChat` - Join a chat room
- `leaveChat` - Leave a chat room
- `sendMessage` - Send a message directly via socket
- `markMessageAsRead` - Mark message as read
- `typing` - Send typing indicator

### Server → Client Events
- `sendMessage` - Receive a message
- `buyerToSellerMessage` - Specific buyer-to-seller message
- `buyerMessageSent` - Confirmation for buyer
- `messageReceived` - General message received event
- `newMessage` - New message notification
- `notification` - Push notification
- `chatMessageUpdate` - Real-time chat update
- `messageReadStatus` - Message read status update

## Database Schema

### Message Schema
```typescript
{
  _id: string;
  message: string;
  sender: string;
  reciver: string;
  idChat: string;
  createdAt: Date;
  isRead: boolean;
}
```

### Notification Schema
```typescript
{
  _id: ObjectId;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  data: any;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

## API Endpoints

### Message Endpoints
- `POST /message/create` - Create a new message
- `GET /message/getAll/:idChat` - Get all messages in a chat
- `POST /message/mark-read/:chatId` - Mark all messages as read
- `GET /message/unread-count/:userId` - Get unread message count

### Chat Endpoints
- `POST /chat/create` - Create a new chat
- `POST /chat/getchats` - Get user's chats
- `POST /chat/delete` - Delete a chat
- `GET /chat/admin-chats` - Get admin chats

## Notification Types

### Message Notifications
- `MESSAGE_RECEIVED` - New message received
- `MESSAGE_ADMIN` - Message from admin
- `CHAT_CREATED` - New chat created

## Real-time Features

### 1. Instant Message Delivery
- Messages are delivered instantly via WebSocket
- Fallback to HTTP API for database storage
- Confirmation events for message status

### 2. Chat Room Management
- Users join/leave chat rooms
- Real-time presence indicators
- Typing indicators

### 3. Message Status
- Delivered/Pending status
- Read receipts
- Message timestamps

## Testing

### Test File
Run the test file to verify the messaging system:
```bash
node test-enhanced-messaging.js
```

### Test Scenarios
1. **Connection Test** - Verify socket connections
2. **Message Delivery** - Test message sending/receiving
3. **Notification Test** - Verify push notifications
4. **Database Test** - Confirm message storage
5. **Real-time Test** - Test live updates

## Configuration

### Socket Configuration
```typescript
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
```

### Message Service Configuration
- Database connection via Mongoose
- Socket gateway integration
- Notification service integration

## Error Handling

### Socket Errors
- Connection failures
- Message delivery failures
- User disconnections

### Database Errors
- Connection issues
- Save failures
- Query errors

### Notification Errors
- Service unavailable
- User not found
- Invalid data

## Performance Considerations

### Socket Management
- Connection pooling
- User session management
- Memory optimization

### Database Optimization
- Indexed queries
- Efficient message retrieval
- Cleanup old messages

### Notification Optimization
- Batch processing
- Rate limiting
- Priority queuing

## Security

### Authentication
- User ID validation
- Socket authentication
- API key protection

### Authorization
- Chat room access control
- Message permissions
- User role validation

## Monitoring

### Logging
- Message creation logs
- Socket connection logs
- Error logs
- Performance metrics

### Metrics
- Message delivery rate
- Socket connection count
- Database performance
- Notification success rate

## Troubleshooting

### Common Issues
1. **Messages not delivered** - Check socket connections
2. **Notifications not sent** - Verify notification service
3. **Database errors** - Check MongoDB connection
4. **Socket disconnections** - Handle reconnection logic

### Debug Tools
- Socket event logging
- Database query logging
- Notification delivery tracking
- Performance monitoring

## Future Enhancements

### Planned Features
1. **Message Encryption** - End-to-end encryption
2. **File Sharing** - Image and file messages
3. **Message Search** - Full-text search
4. **Message Reactions** - Emoji reactions
5. **Voice Messages** - Audio message support
6. **Message Scheduling** - Delayed message sending
7. **Message Translation** - Multi-language support

### Performance Improvements
1. **Message Pagination** - Efficient message loading
2. **Caching** - Redis integration
3. **Load Balancing** - Multiple server instances
4. **CDN Integration** - Global message delivery

## Conclusion

The enhanced messaging system provides a robust, real-time communication platform for buyer-seller interactions with comprehensive notification support and database persistence. The system is designed for scalability, reliability, and user experience.
