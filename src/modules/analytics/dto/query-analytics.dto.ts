import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';

export class QueryAnalyticsDto {
  @IsOptional()
  @IsDateString()
  from?: string; // YYYY-MM-DD

  @IsOptional()
  @IsDateString()
  to?: string; // YYYY-MM-DD

  @IsOptional()
  @IsEnum(['hourly', 'daily'])
  granularity?: 'hourly' | 'daily';

  @IsOptional()
  @IsString()
  userType?: string;

  @IsOptional()
  @IsString()
  deviceType?: string;

  @IsOptional()
  @IsString()
  wilaya?: string;

  @IsOptional()
  @IsString()
  eventName?: string;

  @IsOptional()
  @IsString()
  urlPath?: string;
}
