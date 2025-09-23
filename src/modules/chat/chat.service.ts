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
              console.log("Admin chat already exists, returning existing chat");
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
            
            console.log("Creating new admin chat with data:", chatData);
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
    console.log("🔍 ChatService.getChat called with:");
    console.log("  - id:", id, "(type:", typeof id, ")");
    console.log("  - from:", from, "(type:", typeof from, ")");

    // Handle both string and ObjectId types for users._id
    let queryId: any = id;
    if (require('mongoose').Types.ObjectId.isValid(id)) {
      queryId = new (require('mongoose').Types.ObjectId)(id);
      console.log("✅ Converted to ObjectId:", queryId);
    } else {
      console.log("⚠️ ID is not a valid ObjectId, using as string");
    }

    let chats: Chat[] = [];
    if (from == 'seller') {
      console.log("🔍 Searching for seller chats...");
      chats = await this.chatModel.find({ 'users._id': queryId });
      console.log("📊 Found seller chats:", chats.length);
    } else if (from == 'admin') {
      console.log("🔍 Searching for admin chats...");
      chats = await this.chatModel.find({ 'users._id': 'admin' });
      console.log("📊 Found admin chats:", chats.length);
    } else {
      console.log("🔍 Searching for client chats...");
      chats = await this.chatModel.find({ 'users._id': queryId }).exec();
      console.log("📊 Found client chats:", chats.length);
    }

    console.log("📋 Raw chats data:", chats.map(chat => ({
      id: chat._id,
      users: chat.users.map((u: any) => ({ _id: u._id, firstName: u.firstName, lastName: u.lastName })),
      createdAt: chat.createdAt
    })));

    // Add isAdminChat property to each chat
    const chatsWithAdminFlag = chats.map(chat => {
      const isAdminChat = chat.users.some((user: any) => user._id === 'admin' || user.AccountType === 'admin');
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

}