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