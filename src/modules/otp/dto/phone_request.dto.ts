import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class PhoneRequestDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^(\+213|213|0)?[5-7][0-9]{8}$/, { 
    message: 'Please provide a valid Algerian phone number (e.g., +213660295655, 0660295655)' 
  })
  phone: string;
}