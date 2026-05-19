import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  Min,
} from 'class-validator';
import { DIRECT_SALE_TYPE } from '../schema/direct-sale.schema';

export class CreateDirectSaleDto {
  @IsMongoId()
  @IsNotEmpty()
  owner: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attributes: string[];

  @IsEnum(DIRECT_SALE_TYPE)
  @IsNotEmpty()
  saleType: DIRECT_SALE_TYPE;

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

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  price: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  quantity?: number; // 0 means unlimited

  @IsString()
  @IsNotEmpty()
  wilaya: string;

  @IsString()
  @IsNotEmpty()
  place: string;

  @IsString()
  @IsOptional()
  contactNumber?: string;

  @IsBoolean()
  @IsNotEmpty()
  isPro: boolean;

  @IsBoolean()
  @IsOptional()
  hidden?: boolean;

  @IsBoolean()
  @IsOptional()
  professionalOnly?: boolean;
}

