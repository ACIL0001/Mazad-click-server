import { IsMongoId, IsNotEmpty, IsNumber } from 'class-validator';

export class CreateOfferDto {
  @IsMongoId()
  @IsNotEmpty()
  user: string;

  @IsNumber()
  @IsNotEmpty()
  price: number;


  @IsMongoId()
  @IsNotEmpty()
  owner: string;
}
