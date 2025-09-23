import { IsNotEmpty, IsString } from 'class-validator';

export class CreateParticipantDto {
  @IsNotEmpty()
  @IsString()
  buyer: string;

  @IsNotEmpty()
  @IsString()
  bid: string;
}