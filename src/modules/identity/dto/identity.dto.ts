import { Type } from 'class-transformer';
import { CreateIdentityDto } from './create-identity.dto';

export class IdentityDto extends CreateIdentityDto {
  @Type(() => String)
  _id: string;

  @Type(() => String)
  user: string;

  createdAt: Date;
  updatedAt: Date;
} 