
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class ForgotPasswordEmailDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;
}

export class ResetPasswordEmailDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    code: string;

    @IsString()
    @IsNotEmpty()
    newPassword: string;
}
