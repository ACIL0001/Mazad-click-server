import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString
} from 'class-validator';
import { BID_STATUS, BID_TYPE, AUCTION_TYPE } from '../schema/bid.schema';

export class UpdateBidDto {
  @IsMongoId()
  @IsOptional()
  owner?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attributes?: string[];

  @IsEnum(BID_TYPE)
  @IsOptional()
  type?: BID_TYPE;

  @IsMongoId()
  @IsOptional()
  productCategory?: string;

  @IsMongoId()
  @IsOptional()
  productSubCategory?: string;

  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  thumbs?: string[];

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  startingAt?: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  endingAt?: Date;

  @IsEnum(BID_TYPE)
  @IsOptional()
  bidType?: BID_TYPE;

  @IsEnum(AUCTION_TYPE)
  @IsOptional()
  auctionType?: AUCTION_TYPE;

  @IsNumber()
  @IsOptional()
  startingPrice?: number;

  @IsNumber()
  @IsOptional()
  currentPrice?: number;

  @IsNumber()
  @IsOptional()
  reservePrice?: number;

  @IsNumber()
  @IsOptional()
  instantBuyPrice?: number;

  @IsNumber()
  @IsOptional()
  maxAutoBid?: number;

  @IsMongoId()
  @IsOptional()
  winner?: string;

  @IsEnum(BID_STATUS)
  @IsOptional()
  status?: BID_STATUS;
}
