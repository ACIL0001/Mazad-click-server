import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsObject,
  IsNumber,
  IsEnum,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class EventPositionDto {
  @IsNumber()
  x: number;

  @IsNumber()
  y: number;
}

export class SingleEventDto {
  @IsString()
  @MaxLength(100)
  eventName: string;

  @IsString()
  @MaxLength(500)
  urlPath: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  pageTitle?: string;

  @IsOptional()
  @IsObject()
  properties?: Record<string, any>;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  elementSelector?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => EventPositionDto)
  position?: EventPositionDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  referrer?: string;

  @IsOptional()
  @IsNumber()
  timestamp?: number; // Client-side timestamp for ordering
}

export class IngestEventsDto {
  @IsString()
  sessionId: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SingleEventDto)
  events: SingleEventDto[];

  @IsOptional()
  @IsString()
  userId?: string;
}

export class StartSessionDto {
  @IsString()
  sessionId: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  screenResolution?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  referrer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  landingPage?: string;

  @IsOptional()
  @IsObject()
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };

  @IsOptional()
  @IsString()
  @MaxLength(50)
  userType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  userWilaya?: string;

  @IsOptional()
  @IsString()
  userId?: string;
}

export class EndSessionDto {
  @IsString()
  sessionId: string;

  @IsOptional()
  @IsNumber()
  durationSeconds?: number;

  @IsOptional()
  @IsNumber()
  pageCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  exitPage?: string;
}

export class HeatmapInteractionDto {
  @IsString()
  @MaxLength(500)
  urlPath: string;

  @IsEnum(['click', 'rage_click', 'dead_click', 'scroll'])
  interactionType: string;

  @ValidateNested()
  @Type(() => EventPositionDto)
  position: EventPositionDto;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  elementSelector?: string;

  @IsOptional()
  @IsNumber()
  viewportWidth?: number;

  @IsOptional()
  @IsNumber()
  viewportHeight?: number;

  @IsOptional()
  @IsNumber()
  scrollDepth?: number;
}

export class IngestHeatmapDto {
  @IsString()
  sessionId: string;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => HeatmapInteractionDto)
  interactions: HeatmapInteractionDto[];
}
