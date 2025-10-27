import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Chat, ChatDocument } from "./schema/chat.schema";
import { Model } from 'mongoose';
import { SocketGateway } from 'src/socket/socket.gateway';
import { MessageDocument } from '../messages/schema/schema.messages';
import { UserService } from '../user/user.service';
import { RoleCode } from '../apikey/entity/appType.entity';



 export interface IUser{
  AccountType : string , 
  firstName : string ,
  lastName:string , 
  phone:string ,
  _id:string
}

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Chat.name)
    private chatModel: Model<ChatDocument>,
    private readonly ChatGateWay: SocketGateway,
    private readonly userService: UserService,
  ) {}

  async create(users:IUser[], createdAt:string): Promise<Chat>{
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
    const chat = new this.chatModel({users , createdAt})
    await chat.save()
    
    // Notify the second user (assuming first user is the creator)
    if (users.length > 1) {
      this.ChatGateWay.sendNotificationChatCreateToOne(users[1]._id)
    }
    
    return chat;
  }


  async getChat(id: string, from: string): Promise<any[]> {
    // Handle both string and ObjectId types for users._id
    let queryId: any = id;
    if (require('mongoose').Types.ObjectId.isValid(id)) {
      queryId = new (require('mongoose').Types.ObjectId)(id);
    }

    let chats: Chat[] = [];
    if (from == 'seller') {
      chats = await this.chatModel.find({ 'users._id': queryId });
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
        });
      } catch (error) {
        console.error('Error finding admin users:', error);
        // Fallback to original logic
        chats = await this.chatModel.find({ 'users._id': 'admin' });
      }
    } else {
      chats = await this.chatModel.find({ 'users._id': queryId }).exec();
    }

    // Add isAdminChat property to each chat
    const chatsWithAdminFlag = chats.map(chat => {
      const isAdminChat = chat.users.some((user: any) => 
        user._id === 'admin' || 
        user.AccountType === 'admin' ||
        user.type === 'ADMIN'
      );
      // Cast chat as ChatDocument to access toObject
      return { ...(chat as any).toObject(), isAdminChat };
    });
    
    console.log("✅ Returning chats with admin flag:", chatsWithAdminFlag.length);
    return chatsWithAdminFlag;
  }

  async deletChat(id:string) : Promise<Chat>{
    const deleted = await this.chatModel.findByIdAndDelete(id).exec()
    if(!deleted){
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

}