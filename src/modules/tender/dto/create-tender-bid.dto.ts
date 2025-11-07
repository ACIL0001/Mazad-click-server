import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateTenderBidDto {
  // These fields will be set by the controller, so no validation needed here
  bidder?: string;
  tenderOwner?: string;

  @IsNumber()
  @Min(0, { message: 'Bid amount cannot be negative' })
  bidAmount: number;

  @IsString()
  @IsOptional()
  proposal?: string;

  @IsNumber()
  @IsOptional()
  deliveryTime?: number;
}
