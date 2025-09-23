import { IsString } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  phone: string;

  @IsString()
  code: string;

  @IsString()
  newPassword: string;
} 