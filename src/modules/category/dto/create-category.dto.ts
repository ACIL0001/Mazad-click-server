
// src/category/dto/create-category.dto.ts
import { IsString, IsArray, IsOptional, IsMongoId, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer'; 
import { Attachment } from 'src/modules/attachment/schema/attachment.schema'; 
import { CATEGORY_TYPE } from '../schema/category.schema';

export class CreateCategoryDto {
  @ApiProperty({ description: 'Category name', example: 'Electronics' })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Category type',
    example: 'PRODUCT',
    enum: CATEGORY_TYPE,
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(CATEGORY_TYPE)
  type: string;

  @ApiProperty({
    description: 'Thumbnail image for the category',
    type: 'string',
    format: 'binary',
    required: false,
  })
  @IsOptional()
  @IsMongoId() 
  thumb?: string;

  @ApiProperty({ description: 'Category description', required: false })
  @IsOptional()
  @IsString()
  description?: string;
  
  @ApiProperty({ description: 'Category attributes', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attributes?: string[];

  @ApiProperty({ 
    description: 'Parent category ID (null for root categories)', 
    required: false,
    example: '507f1f77bcf86cd799439011'
  })
  @IsOptional()
  @IsMongoId()
  parent?: string | null;
}