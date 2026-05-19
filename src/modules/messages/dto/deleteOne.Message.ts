import {
  IsString,
  IsNotEmpty,
} from 'class-validator';


export class DeleteOneMessageDto {
  @IsNotEmpty()
  @IsString()
  id: string;
}