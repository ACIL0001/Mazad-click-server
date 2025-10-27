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

  @Prop({ 
    type: {
      _id: String,
      url: String,
      name: String,
      type: String,
      size: Number,
      filename: String
    }
  })
  attachment?: {
    _id: string;
    url: string;
    name: string;
    type: string;
    size: number;
    filename: string;
  };
}

export type MessageDocument = HydratedDocument<Message>
export const MessageSchema = SchemaFactory.createForClass(Message)