import {
  IsArray,
  IsString,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsObject,
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

  @IsOptional()
  @IsObject()
  attachment?: {
    _id: string;
    url: string;
    name: string;
    type: string;
    size: number;
    filename: string;
  };
}