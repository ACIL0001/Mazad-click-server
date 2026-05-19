import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";



@Schema({ timestamps: true })
export class Chat {
  _id: string;

  @Prop({ type: [Object] })
  users: object[];

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Boolean, default: false })
  isRead: boolean;
}

export type ChatDocument = HydratedDocument<Chat>;
export const ChatSchema = SchemaFactory.createForClass(Chat)