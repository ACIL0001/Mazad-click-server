import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class OtpConfirmationDto {
  @IsString()
  @IsNotEmpty()
  @Length(5, 5, { message: 'OTP code must be exactly 5 digits' })
  @Matches(/^\d{5}$/, { message: 'OTP code must contain only digits' })
  code: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^(\+213|213|0)?[5-7][0-9]{8}$/, { 
    message: 'Please provide a valid Algerian phone number (e.g., +213660295655, 0660295655)' 
  })
  phone: string;
}