import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsEnum,
  IsPhoneNumber,
  ValidateIf,
  ValidateNested,
  IsOptional,
  IsObject,
  IsDefined,
} from 'class-validator';
import { RoleCode } from 'src/modules/apikey/entity/appType.entity';
import { Type } from 'class-transformer';

export class IdentityDto {
  @ValidateIf((o, v) => o.type === 'PROFESSIONAL')
  @IsDefined({ message: 'commercialRegister is required for PROFESSIONAL' })
  commercialRegister?: string;

  @ValidateIf((o, v) => o.type === 'PROFESSIONAL')
  @IsDefined({ message: 'nif is required for PROFESSIONAL' })
  nif?: string;

  @ValidateIf((o, v) => o.type === 'PROFESSIONAL')
  @IsDefined({ message: 'nis is required for PROFESSIONAL' })
  nis?: string;

  @ValidateIf((o, v) => o.type === 'PROFESSIONAL')
  @IsDefined({ message: 'last3YearsBalanceSheet is required for PROFESSIONAL' })
  last3YearsBalanceSheet?: string;

  @ValidateIf((o, v) => o.type === 'PROFESSIONAL')
  @IsDefined({ message: 'certificates is required for PROFESSIONAL' })
  certificates?: string;

  @ValidateIf((o, v) => o.type === 'RESELLER')
  @IsDefined({ message: 'identityCard is required for RESELLER' })
  identityCard?: string;
}

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  email?: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  @IsPhoneNumber('DZ')
  phone: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(Object.values(RoleCode))
  type: RoleCode;

  @IsOptional()
  @IsString()
  secteur?: string;

  @IsOptional()
  @IsString()
  entreprise?: string;

  @IsOptional()
  @IsString()
  postOccupé?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => IdentityDto)
  identity?: IdentityDto;
}
