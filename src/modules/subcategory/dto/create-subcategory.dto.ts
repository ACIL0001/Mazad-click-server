import { IsString, IsArray, IsOptional, IsMongoId, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Attachment } from 'src/modules/attachment/schema/attachment.schema';
import { CATEGORY_TYPE } from '../schema/subcategory.schema';


export class CreateSubCategoryDto {
  @ApiProperty({ description: 'Category name', example: 'Electronics' })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Category type',
    // example: 'PRODUCT',
    // enum: CATEGORY_TYPE,
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(CATEGORY_TYPE)
  type: string;

   // Add description field
  @ApiProperty({ description: 'SubCategory description', example: 'Subcategory for electronic gadgets' })
  @IsOptional()
  @IsString()
  description?: string;


  

  @ApiProperty({
    description: 'Thumbnail image for the category',
    type: 'string',
    format: 'binary',
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  thumb?: string;

  @ApiProperty({
    description: 'Array of attribute names',
    type: [String],
    required: false,
  })
  @IsArray()
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value.split(',');
      }
    }
    return value;
  })
  attributes?: string[];
}
