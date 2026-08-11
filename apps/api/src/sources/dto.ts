import { SourceType } from '@control-tower/shared-types';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const CRON_RE =
  /^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/;

export class CreateSourceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsEnum(SourceType)
  type!: SourceType;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @Matches(CRON_RE, { message: 'schedule must be a 5-field cron expression' })
  schedule?: string;

  @IsOptional()
  @IsObject()
  configJson?: Record<string, unknown>;
}

export class UpdateSourceDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsEnum(SourceType)
  type?: SourceType;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @Matches(CRON_RE, { message: 'schedule must be a 5-field cron expression' })
  schedule?: string | null;

  @IsOptional()
  @IsObject()
  configJson?: Record<string, unknown>;
}
