import { PartialType } from '@nestjs/mapped-types';
import { CreateDirectSaleDto } from './create-direct-sale.dto';
import { IsOptional, IsEnum } from 'class-validator';
import { DIRECT_SALE_STATUS } from '../schema/direct-sale.schema';

export class UpdateDirectSaleDto extends PartialType(CreateDirectSaleDto) {
  @IsEnum(DIRECT_SALE_STATUS)
  @IsOptional()
  status?: DIRECT_SALE_STATUS;
}

