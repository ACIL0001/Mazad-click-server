import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsString,
} from 'class-validator';

export class PurchaseDirectSaleDto {
  @IsMongoId()
  @IsNotEmpty()
  directSaleId: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  quantity: number;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  paymentReference?: string;
}

