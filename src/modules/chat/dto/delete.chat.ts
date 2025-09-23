import {

  IsString,

  IsNotEmpty,
} from 'class-validator';


export class DeletChatDto {
    @IsNotEmpty()
    @IsString({each:true})
    id : string ; 
}