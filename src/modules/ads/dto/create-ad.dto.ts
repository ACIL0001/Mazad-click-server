import { IsString, IsOptional, IsMongoId, IsNotEmpty, IsBoolean, IsNumber, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAdDto {
  @ApiProperty({ description: 'Ad title', example: 'Summer Sale 2024' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Image attachment ID',
    type: 'string',
    required: true,
  })
  @IsMongoId()
  @IsNotEmpty()
  image: string;

  @ApiProperty({ 
    description: 'URL to redirect when ad is clicked', 
    example: '/category or https://example.com' 
  })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty({ 
    description: 'Whether the ad is active', 
    default: true 
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ 
    description: 'Whether the ad should be displayed on homepage', 
    default: false 
  })
  @IsOptional()
  @IsBoolean()
  isDisplayed?: boolean;

  @ApiProperty({ 
    description: 'Display order (lower numbers appear first)', 
    default: 0 
  })
  @IsOptional()
  @IsNumber()
  order?: number;
}

