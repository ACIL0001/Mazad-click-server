import {

  IsString,

  IsNotEmpty,
} from 'class-validator';


export class getChatDto {
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsNotEmpty()
  @IsString()
  from : string;
}