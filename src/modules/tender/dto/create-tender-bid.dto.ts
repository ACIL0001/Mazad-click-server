import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTenderBidDto {
  @IsString()
  @IsOptional()
  bidder?: string;

  @IsString()
  @IsOptional()
  tenderOwner?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Bid amount cannot be negative' })
  bidAmount: number;

  @IsString()
  @IsOptional()
  proposal?: string;

  @IsString()
  @IsOptional()
  proposalFile?: string; // URL stored after file upload by the controller

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  deliveryTime?: number;
}
