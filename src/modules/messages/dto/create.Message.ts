import {
  IsArray,
  IsString,
  IsDateString,
  IsNotEmpty,
} from 'class-validator';


export class CrateMessageDto {
  @IsNotEmpty()
  @IsString()
  message: string;

  @IsNotEmpty()
  @IsString()
  sender: string;

  @IsNotEmpty()
  @IsString()
  reciver: string;

  @IsNotEmpty()
  @IsString()
  idChat: string;


}