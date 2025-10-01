import { IsString, IsNumber, IsOptional, IsEnum, IsArray, IsBoolean, IsDateString } from 'class-validator';
import { TENDER_TYPE, TENDER_AUCTION_TYPE } from '../schema/tender.schema';

export class CreateTenderDto {
  @IsString()
  owner: string;

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsArray()
  @IsOptional()
  requirements?: string[];

  @IsString()
  category: string;

  @IsString()
  @IsOptional()
  subCategory?: string;

  @IsArray()
  @IsOptional()
  attachments?: string[];

  @IsDateString()
  startingAt: string;

  @IsDateString()
  endingAt: string;

  @IsEnum(TENDER_TYPE)
  tenderType: TENDER_TYPE;

  @IsEnum(TENDER_AUCTION_TYPE)
  @IsOptional()
  auctionType?: TENDER_AUCTION_TYPE;


  @IsString()
  @IsOptional()
  quantity?: string;

  @IsString()
  wilaya: string;

  @IsString()
  location: string;

  @IsNumber()
  @IsOptional()
  maxBudget?: number;

  @IsBoolean()
  isPro: boolean;

}
