import { IsString, IsOptional, IsEmail, ValidateIf } from 'class-validator';

export class ForgotPasswordDto {
    @ValidateIf(o => !o.phone)
    @IsEmail({}, { message: 'Invalid email format' })
    @IsOptional()
    email?: string;

    @ValidateIf(o => !o.email)
    @IsString({ message: 'Phone must be a string' })
    @IsOptional()
    phone?: string;
}
