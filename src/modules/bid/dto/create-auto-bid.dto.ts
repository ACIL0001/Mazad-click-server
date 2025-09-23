import { IsNumber, IsString, IsNotEmpty, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAutoBidDto {
  @ApiProperty({ description: 'The user ID who creates the auto-bid' })
  @IsString()
  @IsNotEmpty()
  user: string;

  @ApiProperty({ description: 'The bid/auction ID' })
  @IsString()
  @IsNotEmpty()
  bid: string;

  @ApiProperty({ description: 'The auto-bid price', minimum: 1 })
  @IsNumber()
  @Min(1)
  price: number;
} 