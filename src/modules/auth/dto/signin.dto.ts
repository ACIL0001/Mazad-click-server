import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Validate } from 'class-validator';
import { IsEmailOrPhoneNumber } from './utils.dto';

export class SignInDto {
  @IsString()
  @IsNotEmpty()
  @Validate(IsEmailOrPhoneNumber)
  @Transform(({ value }) => value.toLowerCase())
  login: string;

  @IsString()
  // @IsStrongPassword()
  @IsNotEmpty()
  password: string;
}
