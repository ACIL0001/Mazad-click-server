import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  IsMongoId,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import { AUCTION_TYPE } from '../schema/bid.schema';

export class RelaunchBidDto {
  @IsMongoId()
  @IsNotEmpty()
  originalBidId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsOptional()
  quantity?: string;

  @IsString()
  @IsOptional()
  wilaya?: string;

  @IsString()
  @IsNotEmpty()
  place: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attributes?: string[];

  @IsEnum(AUCTION_TYPE)
  @IsOptional()
  auctionType?: AUCTION_TYPE;

  @IsNumber()
  @IsNotEmpty()
  @Min(1, { message: 'Starting price must be at least 1' })
  @Type(() => Number)
  startingPrice: number;

  @IsNumber()
  @IsOptional()
  @Min(1, { message: 'Reserve price must be at least 1' })
  @Type(() => Number)
  reservePrice?: number;

  @IsNumber()
  @IsOptional()
  @Min(1, { message: 'Instant buy price must be at least 1' })
  @Type(() => Number)
  instantBuyPrice?: number;

  @IsNumber()
  @IsOptional()
  @Min(1, { message: 'Max auto bid must be at least 1' })
  @Type(() => Number)
  maxAutoBid?: number;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  startingAt: Date;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  endingAt: Date;

  @IsBoolean()
  @IsOptional()
  hidden?: boolean;

  @IsBoolean()
  @IsNotEmpty()
  isPro: boolean;
}
