import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateTenderBidDto {
  @IsString()
  bidder: string;

  @IsString()
  tenderOwner: string;

  @IsNumber()
  bidAmount: number;

  @IsString()
  @IsOptional()
  proposal?: string;

  @IsNumber()
  @IsOptional()
  deliveryTime?: number;
}
