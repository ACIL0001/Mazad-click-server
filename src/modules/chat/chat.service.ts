import { Action } from 'rxjs/internal/scheduler/Action';
import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Chat, ChatDocument } from "./schema/chat.schema";
import { Model } from 'mongoose';
import { SocketGateway } from 'src/socket/socket.gateway';
import { MessageDocument } from '../messages/schema/schema.messages';
import { UserService } from '../user/user.service';
import { RoleCode } from '../apikey/entity/appType.entity';
import { MessageService } from '../messages/messages.service';



export interface IUser {
  AccountType: string,
  firstName: string,
  lastName: string,
  phone: string,
  _id: string
}

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Chat.name)
    private chatModel: Model<ChatDocument>,
    private readonly ChatGateWay: SocketGateway,
    private readonly userService: UserService,
    @Inject(forwardRef(() => MessageService))
    private readonly messageService: MessageService,
  ) { }

  async create(users: IUser[], createdAt: string): Promise<Chat> {
    console.log("Creating chat with users:", users);

    // Check if this is an admin chat (one user has AccountType = 'admin')
    const isAdminChat = users.some(user => user.AccountType === 'admin' || user._id === 'admin');

    if (isAdminChat) {
      console.log("This is an admin chat");

      // For admin chats, we need to find the actual admin users from the database
      try {
        const adminUsers = await this.userService.findUsersByRoles([RoleCode.ADMIN]);
        console.log("Found admin users:", adminUsers);

        if (adminUsers && adminUsers.length > 0) {
          // Use the first admin user for the chat
          const adminUser = adminUsers[0];
          const regularUser = users.find(user => user.AccountType !== 'admin' && user._id !== 'admin');

          if (regularUser) {
            // Check if a chat between this user and admin already exists
            const existingChat = await this.chatModel.findOne({
              $and: [
                { 'users._id': adminUser._id },
                { 'users._id': regularUser._id }
              ]
            });

            if (existingChat) {
              return existingChat;
            }

            // Create new admin chat with actual admin user
            const chatData = {
              users: [
                {
                  _id: adminUser._id,
                  firstName: adminUser.firstName,
                  lastName: adminUser.lastName,
                  AccountType: 'admin',
                  phone: adminUser.phone || ''
                },
                {
                  _id: regularUser._id,
                  firstName: regularUser.firstName,
                  lastName: regularUser.lastName,
                  AccountType: regularUser.AccountType,
                  phone: regularUser.phone || ''
                }
              ],
              createdAt: new Date(createdAt)
            };

            const chat = new this.chatModel(chatData);
            await chat.save();

            // Notify the regular user that chat was created
            this.ChatGateWay.sendNotificationChatCreateToOne(regularUser._id);

            return chat;
          }
        }
      } catch (error) {
        console.error("Error creating admin chat:", error);
        // Fallback to original logic
      }
    }

    // Original logic for non-admin chats or fallback
    console.log("Using original chat creation logic");

    // Check if chat already exists between these two users
    if (users.length >= 2) {
      const userId1 = users[0]._id?.toString() || users[0]._id;
      const userId2 = users[1]._id?.toString() || users[1]._id;

      const existingChat = await this.chatModel.findOne({
        $and: [
          { 'users._id': { $in: [userId1, userId2] } },
          { 'users._id': { $in: [userId1, userId2] } }
        ],
        $expr: {
          $eq: [
            { $size: { $setIntersection: ['$users._id', [userId1, userId2]] } },
            2
          ]
        }
      }).lean();

      // Alternative simpler query
      if (!existingChat) {
        const existingChat2 = await this.chatModel.findOne({
          $and: [
            { 'users._id': userId1 },
            { 'users._id': userId2 }
          ]
        }).lean();

        if (existingChat2) {
          console.log("✅ Found existing chat between users:", userId1, userId2);
          return existingChat2 as Chat;
        }
      } else {
        console.log("✅ Found existing chat between users:", userId1, userId2);
        return existingChat as Chat;
      }
    }

    // Create new chat if it doesn't exist
    console.log("📝 Creating new chat between users");
    const chat = new this.chatModel({ users, createdAt })
    await chat.save()

    // Notify the second user (assuming first user is the creator)
    if (users.length > 1) {
      this.ChatGateWay.sendNotificationChatCreateToOne(users[1]._id)
    }

    return chat;
  }


  async getChat(id: string, from: string): Promise<any[]> {
    console.log('🔍 ChatService.getChat called with:', { id, from, idType: typeof id });

    // Handle both string and ObjectId types for users._id
    // Try multiple query formats to ensure we find all chats
    let queryId: any = id;
    const mongoose = require('mongoose');

    // Try as string first
    let chats: Chat[] = [];

    if (from == 'seller') {
      // For seller, try multiple query formats to ensure we find all chats
      // Query 1: Try with string ID
      chats = await this.chatModel.find({
        $or: [
          { 'users._id': id },
          { 'users._id': id.toString() }
        ]
      }).lean();

      // Query 2: If valid ObjectId, also try with ObjectId
      if (mongoose.Types.ObjectId.isValid(id)) {
        const objectIdQuery = await this.chatModel.find({
          'users._id': new mongoose.Types.ObjectId(id)
        }).lean();

        // Merge results and deduplicate
        const allChats = [...chats, ...objectIdQuery];
        const uniqueChats = allChats.filter((chat, index, self) =>
          index === self.findIndex(c => c._id.toString() === chat._id.toString())
        );
        chats = uniqueChats;
      }

      console.log(`📊 Found ${chats.length} chats for seller ${id}`);
      if (chats.length > 0) {
        console.log('📋 Sample chat structure:', {
          _id: chats[0]._id,
          usersCount: chats[0].users?.length,
          users: chats[0].users?.map((u: any) => ({ _id: u._id, firstName: u.firstName, AccountType: u.AccountType }))
        });
      }
    } else if (from == 'admin') {
      // For admin, find chats where either:
      // 1. One user has _id === 'admin' OR AccountType === 'admin'
      // 2. One user is an actual admin user from the database
      try {
        const adminUsers = await this.userService.findUsersByRoles([RoleCode.ADMIN]);
        const adminUserIds = adminUsers.map(admin => admin._id.toString());

        chats = await this.chatModel.find({
          $or: [
            { 'users._id': 'admin' },
            { 'users.AccountType': 'admin' },
            { 'users._id': { $in: adminUserIds } }
          ]
        }).lean();
      } catch (error) {
        console.error('Error finding admin users:', error);
        // Fallback to original logic
        chats = await this.chatModel.find({ 'users._id': 'admin' }).lean();
      }
    } else {
      // For buyer or other users
      chats = await this.chatModel.find({
        $or: [
          { 'users._id': id },
          { 'users._id': id.toString() }
        ]
      }).lean();

      if (mongoose.Types.ObjectId.isValid(id)) {
        const objectIdQuery = await this.chatModel.find({
          'users._id': new mongoose.Types.ObjectId(id)
        }).lean();

        const allChats = [...chats, ...objectIdQuery];
        const uniqueChats = allChats.filter((chat, index, self) =>
          index === self.findIndex(c => c._id.toString() === chat._id.toString())
        );
        chats = uniqueChats;
      }
    }

    // Ensure chats have proper structure and filter out invalid ones
    const validChats = chats.filter(chat => {
      const isValid = chat &&
        chat._id &&
        Array.isArray(chat.users) &&
        chat.users.length >= 2; // Each chat should have exactly 2 users
      if (!isValid) {
        console.warn('⚠️ Invalid chat found:', chat);
      }
      return isValid;
    });

    // Add isAdminChat property to each chat
    const chatsWithAdminFlag = validChats.map(chat => {
      const isAdminChat = chat.users.some((user: any) =>
        user._id === 'admin' ||
        user.AccountType === 'admin' ||
        user.type === 'ADMIN'
      );
      return {
        ...chat,
        isAdminChat,
        // Ensure users array is properly formatted
        users: chat.users.map((user: any) => ({
          _id: user._id?.toString() || user._id,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          AccountType: user.AccountType || '',
          phone: user.phone || ''
        }))
      };
    });

    console.log(`✅ Returning ${chatsWithAdminFlag.length} valid chats (filtered from ${chats.length} total)`);
    return chatsWithAdminFlag;
  }

  async deletChat(id: string): Promise<Chat> {
    const deleted = await this.chatModel.findByIdAndDelete(id).exec()
    if (!deleted) {
      throw new NotFoundException(`chat with this id ${id} is not found`)
    }
    return deleted;
  }

  async getChatsByAdmin(): Promise<Chat[]> {
    // Find all chats where one of the users has _id === 'admin' OR AccountType === 'admin'
    const chats = await this.chatModel.find({
      $or: [
        { 'users._id': 'admin' },
        { 'users.AccountType': 'admin' }
      ]
    }).exec();

    console.log(`Found ${chats.length} admin chats`);
    return chats;
  }

  async getGuestChats(): Promise<Chat[]> {
    // Find all chats where one of the users has _id === 'guest' OR AccountType === 'guest'
    const chats = await this.chatModel.find({
      $or: [
        { 'users._id': 'guest' },
        { 'users.AccountType': 'guest' }
      ]
    }).exec();

    console.log(`Found ${chats.length} guest chats`);
    return chats;
  }

  async findGuestChatByInfo(guestName: string, guestPhone: string): Promise<Chat | null> {
    // Find a guest chat by matching guest name and phone
    const chat = await this.chatModel.findOne({
      $and: [
        {
          $or: [
            { 'users._id': 'guest' },
            { 'users.AccountType': 'guest' }
          ]
        },
        {
          $or: [
            { 'users.firstName': guestName },
            { 'users.phone': guestPhone }
          ]
        }
      ]
    }).exec();

    if (chat) {
      console.log(`Found guest chat by info: ${chat._id}`);
    } else {
      console.log(`No guest chat found for ${guestName} (${guestPhone})`);
    }

    return chat;
  }

  async broadcastMessage(message: string, senderId: string): Promise<{ success: boolean; count: number }> {
    console.log('📢 Starting broadcast message:', message);

    try {
      // 1. Fetch all users (excluding admin)
      // Use findAllBuyers as a base, but we might want all users
      // For now, let's target CLIENT users as they are the main audience
      // We can also fetch all users and filter
      const allUsers = await this.userService.findUsersByRoles([RoleCode.CLIENT, RoleCode.PROFESSIONAL, RoleCode.RESELLER]);
      console.log(`📢 Found ${allUsers.length} users to broadcast to`);

      let sentCount = 0;

      // 2. Iterate and send message
      for (const user of allUsers) {
        try {
          const userId = user._id.toString();

          // Skip if user is the sender (unlikely for admin broadcast but good safety)
          if (userId === senderId) continue;

          // 3. Create or get chat between admin and user
          // We can use the create method we already have
          const adminUser = {
            AccountType: 'admin',
            firstName: 'Admin',
            lastName: '',
            phone: '',
            _id: 'admin'
          };

          const targetUser = {
            AccountType: user.type,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            _id: userId
          };

          // Use our create method which handles finding existing chats
          const chat = await this.create([adminUser, targetUser], new Date().toISOString());

          if (chat) {
            // 4. Send the message using MessageService
            // This handles socket events and notifications automatically
            await this.messageService.create(
              senderId, // sender (admin)
              userId,   // receiver
              message,
              chat._id,
              {}
            );
            sentCount++;
          }
        } catch (err) {
          console.error(`❌ Failed to send broadcast to user ${user._id}:`, err);
          // Continue to next user even if one fails
        }
      }

      console.log(`✅ Broadcast complete. Sent to ${sentCount} users.`);
      return { success: true, count: sentCount };

    } catch (error) {
      console.error('❌ Broadcast failed:', error);
      throw error;
    }
  }

}