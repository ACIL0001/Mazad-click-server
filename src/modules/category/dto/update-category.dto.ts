// src/category/dto/update-category.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateCategoryDto } from './create-category.dto';

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

// src/category/dto/move-category.dto.ts
import { IsOptional, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MoveCategoryDto {
  @ApiProperty({ 
    description: 'New parent category ID (null to move to root level)', 
    required: false,
    example: '507f1f77bcf86cd799439011'
  })
  @IsOptional()
  @IsMongoId()
  newParent?: string | null;
}