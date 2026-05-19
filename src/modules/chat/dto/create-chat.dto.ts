import {
  IsArray,
  IsString,
  IsDateString,
  IsNotEmpty,
} from 'class-validator';
import { IUser } from '../chat.service';


export class CrateChatDto {
  @IsArray()
  @IsNotEmpty()
  users: IUser[];

  @IsDateString()
  createdAt: string;
}