import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";



@Schema({ timestamps: true })
export class Message {
  _id: string;

  @Prop({ type: String })
  message: string;

  @Prop({ type: String })
  sender: string;

  @Prop({ type: String })
  reciver: string;

  @Prop({ type: String })
  idChat: string;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Boolean, default: false })
  isRead: boolean;  
}

export type MessageDocument = HydratedDocument<Message>
export const MessageSchema = SchemaFactory.createForClass(Message)