import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class AttachmentDto {
  @IsOptional()
  @Type(() => String)
  filename?: string;

  @IsOptional()
  @Type(() => String)
  url?: string;
}

export class CreateIdentityDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => AttachmentDto)
  commercialRegister?: AttachmentDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AttachmentDto)
  carteAutoEntrepreneur?: AttachmentDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AttachmentDto)
  nif?: AttachmentDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AttachmentDto)
  nis?: AttachmentDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AttachmentDto)
  last3YearsBalanceSheet?: AttachmentDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AttachmentDto)
  certificates?: AttachmentDto;
} 