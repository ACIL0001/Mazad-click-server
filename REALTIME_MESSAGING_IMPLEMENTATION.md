# Real-time Messaging Implementation

## Overview
This document describes the enhanced real-time messaging system that includes socket.io integration, database persistence, and notification delivery for the MazadClick platform.

## Features Implemented

### 1. Real-time Message Delivery
- **Socket.io Integration**: Messages are delivered instantly via WebSocket connections
- **Database Persistence**: All messages are saved to MongoDB for persistence
- **Multi-user Support**: Supports multiple users in the same chat room
- **Admin Chat Support**: Special handling for admin-to-user and user-to-admin messages

### 2. Notification System
- **Real-time Notifications**: Notifications are sent via socket and saved to database
- **Multiple Notification Types**: Support for different notification types (MESSAGE_RECEIVED, MESSAGE_ADMIN, etc.)
- **Unread Count Tracking**: Track unread message and notification counts
- **User-specific Notifications**: Notifications are targeted to specific users

### 3. Enhanced Socket Events
- **Message Events**: `sendMessage`, `newMessage`, `messageReceived`, `messageSent`
- **Chat Room Events**: `joinChat`, `leaveChat`, `userJoinedChat`, `userLeftChat`
- **Typing Indicators**: `typing`, `userTyping`
- **Read Status**: `markMessageAsRead`, `messageRead`
- **Real-time Updates**: `realtimeMessageUpdate`

## API Endpoints

### Message Endpoints
```
POST /message/create
- Creates a new message
- Sends via socket to recipient
- Creates notification
- Saves to database

GET /message/getAll/:idChat
- Retrieves all messages for a chat

POST /message/mark-read/:chatId
- Marks all messages in a chat as read

GET /message/unread-count/:userId
- Gets unread message count for a user
```

### Chat Endpoints
```
POST /chat/create
- Creates a new chat between users
- Sends notification to participants

POST /chat/getchats
- Gets all chats for a user

GET /chat/admin-chats
- Gets all admin chats
```

### Notification Endpoints
```
GET /notification/user/:userId
- Gets notifications for a user

POST /notification/mark-read/:id
- Marks a notification as read

GET /notification/unread-count/:userId
- Gets unread notification count
```

## Socket Events

### Client to Server Events
```javascript
// Join a chat room
socket.emit('joinChat', { chatId: 'chat123', userId: 'user456' });

// Leave a chat room
socket.emit('leaveChat', { chatId: 'chat123', userId: 'user456' });

// Send typing indicator
socket.emit('typing', { chatId: 'chat123', userId: 'user456', isTyping: true });

// Mark message as read
socket.emit('markMessageAsRead', { messageId: 'msg123', chatId: 'chat123', userId: 'user456' });

// Test socket connection
socket.emit('test', { message: 'Hello Server!' });
```

### Server to Client Events
```javascript
// Message received
socket.on('sendMessage', (data) => {
  // data: { message, reciver, idChat, sender, _id, createdAt, isSocket }
});

// New message notification
socket.on('newMessage', (data) => {
  // data: { message, reciver, idChat, sender, messageId, createdAt }
});

// Message received confirmation
socket.on('messageReceived', (data) => {
  // data: { message, sender, chatId, messageId, timestamp }
});

// Message sent confirmation
socket.on('messageSent', (data) => {
  // data: { message, reciver, chatId, messageId, timestamp, status }
});

// User joined chat
socket.on('userJoinedChat', (data) => {
  // data: { userId, chatId, timestamp }
});

// User left chat
socket.on('userLeftChat', (data) => {
  // data: { userId, chatId, timestamp }
});

// Typing indicator
socket.on('userTyping', (data) => {
  // data: { userId, chatId, isTyping, timestamp }
});

// Message read status
socket.on('messageRead', (data) => {
  // data: { messageId, chatId, userId, timestamp }
});

// Real-time message update
socket.on('realtimeMessageUpdate', (data) => {
  // data: { message, chatId, timestamp }
});

// Notification
socket.on('notification', (data) => {
  // data: { _id, userId, type, title, message, data, read, createdAt }
});
```

## Database Schema

### Message Schema
```javascript
{
  _id: ObjectId,
  message: String,
  sender: String,
  reciver: String,
  idChat: String,
  createdAt: Date,
  isRead: Boolean
}
```

### Chat Schema
```javascript
{
  _id: ObjectId,
  users: [Object], // Array of user objects
  createdAt: Date,
  isRead: Boolean
}
```

### Notification Schema
```javascript
{
  _id: ObjectId,
  userId: String,
  title: String,
  message: String,
  type: String, // MESSAGE_RECEIVED, MESSAGE_ADMIN, etc.
  data: Object,
  read: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

## Message Flow

### 1. User Sends Message
1. Frontend calls `POST /message/create`
2. Message is saved to database
3. Socket event `sendMessage` is emitted to recipient
4. Notification is created and sent via socket
5. Real-time update is broadcast to chat room

### 2. Admin Sends Message
1. Frontend calls `POST /message/create` with sender='admin'
2. Message is saved to database
3. Socket event `adminMessage` is emitted to user
4. Notification is created and sent via socket
5. All admin interfaces are updated

### 3. User Sends Message to Admin
1. Frontend calls `POST /message/create` with reciver='admin'
2. Message is saved to database
3. Socket event `sendMessage` is broadcast to all admins
4. Notifications are created for all admins
5. Real-time update is broadcast

## Testing

### Run the Test Script
```bash
cd server
node test-realtime-messaging.js
```

The test script will:
1. Connect user and admin sockets
2. Join chat rooms
3. Send messages via API
4. Test typing indicators
5. Test read status
6. Test notifications
7. Test chat room events

### Manual Testing
1. Start the server: `npm run start:dev`
2. Open multiple browser tabs
3. Connect to the chat interface
4. Send messages between users
5. Verify real-time delivery
6. Check notifications
7. Test admin chat functionality

## Configuration

### Socket.io Configuration
```javascript
@WebSocketGateway({
  cors: {
    origin: '*', // Configure for production
  },
})
```

### Environment Variables
```env
MONGODB_URI=mongodb://localhost:27017/mazadclick
PORT=3000
JWT_SECRET=your-jwt-secret
```

## Error Handling

### Socket Connection Errors
- Automatic reconnection on disconnect
- Error logging for debugging
- Graceful fallback for offline users

### Database Errors
- Transaction rollback on failures
- Error logging and monitoring
- Retry mechanisms for critical operations

### Notification Errors
- Fallback to database-only notifications
- Error logging for failed deliveries
- Retry mechanisms for critical notifications

## Performance Considerations

### Socket Connection Management
- Efficient user tracking
- Automatic cleanup on disconnect
- Connection pooling

### Database Optimization
- Indexed queries for messages and notifications
- Efficient pagination
- Caching for frequently accessed data

### Real-time Updates
- Selective broadcasting
- Event throttling
- Connection state management

## Security Considerations

### Authentication
- JWT token validation
- User session management
- Role-based access control

### Data Validation
- Input sanitization
- Message length limits
- File upload restrictions

### Rate Limiting
- Message sending limits
- Connection rate limits
- API endpoint protection

## Monitoring and Logging

### Logging
- Comprehensive logging for all operations
- Error tracking and monitoring
- Performance metrics

### Metrics
- Message delivery rates
- Socket connection counts
- Database performance
- Notification delivery rates

## Future Enhancements

### Planned Features
- File sharing in messages
- Message encryption
- Voice messages
- Video calls
- Message reactions
- Message editing/deletion
- Message search
- Chat history export

### Scalability
- Redis for session management
- Load balancing for multiple servers
- Database sharding
- CDN for file uploads

## Troubleshooting

### Common Issues
1. **Messages not delivered**: Check socket connection and user online status
2. **Notifications not received**: Verify notification service and socket events
3. **Database errors**: Check MongoDB connection and schema validation
4. **Performance issues**: Monitor database queries and socket connections

### Debug Commands
```bash
# Check socket connections
npm run test:socket

# Check database status
npm run test:db

# Check notification system
npm run test:notifications
```

## Support

For issues or questions regarding the real-time messaging system:
1. Check the logs for error messages
2. Verify socket connections
3. Test with the provided test script
4. Review the API documentation
5. Contact the development team
