import {
  IsArray,
  IsString,
  IsDateString,
  IsNotEmpty,
} from 'class-validator';


export class GetMessageDto {
  @IsNotEmpty()
  @IsString()
  idChat: string;
}