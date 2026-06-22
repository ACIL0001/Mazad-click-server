import { IsString, IsOptional, IsEmail, ValidateIf } from 'class-validator';

export class ForgotPasswordDto {
    @IsEmail({}, { message: 'Invalid email format' })
    @IsOptional()
    email?: string;

    @IsString({ message: 'Phone must be a string' })
    @IsOptional()
    phone?: string;
}
