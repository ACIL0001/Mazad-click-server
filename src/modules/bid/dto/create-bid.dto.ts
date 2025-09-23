import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
} from 'class-validator';
import { BID_TYPE, AUCTION_TYPE } from '../schema/bid.schema';

export class CreateBidDto {
  @IsMongoId()
  @IsNotEmpty()
  owner: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  quantity: string;

  
  @IsString()
  wilaya: string;

  @IsBoolean()
  @IsNotEmpty()
  isPro: boolean;

  @IsString()
  @IsNotEmpty()
  place: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attributes: string[];

  @IsEnum(BID_TYPE)
  @IsNotEmpty()
  bidType: BID_TYPE;

  @IsMongoId()
  @IsNotEmpty()
  productCategory: string;

  @IsMongoId()
  @IsOptional()
  productSubCategory?: string;

  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  thumbs: string[];

  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  videos: string[];

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  startingAt: Date;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  endingAt: Date;

  @IsEnum(AUCTION_TYPE)
  @IsOptional()
  auctionType?: AUCTION_TYPE;

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  startingPrice: number;

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  currentPrice: number;

  @IsNumber()
  @IsOptional()
  reservePrice?: number;

  @IsNumber()
  @IsOptional()
  instantBuyPrice?: number;

  @IsNumber()
  @IsOptional()
  maxAutoBid?: number;

  @IsBoolean()
  @IsOptional()
  hidden?: boolean;
}
