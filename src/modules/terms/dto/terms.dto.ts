import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateTermsDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsNotEmpty()
  version: string;
}

export class UpdateTermsDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  version?: string;
}