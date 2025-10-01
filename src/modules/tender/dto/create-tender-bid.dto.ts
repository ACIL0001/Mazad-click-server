import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateTenderBidDto {
  // These fields will be set by the controller, so no validation needed here
  bidder?: string;
  tenderOwner?: string;

  @IsNumber()
  @Min(1, { message: 'Bid amount must be greater than 0' })
  bidAmount: number;

  @IsString()
  @IsOptional()
  proposal?: string;

  @IsNumber()
  @IsOptional()
  deliveryTime?: number;
}
