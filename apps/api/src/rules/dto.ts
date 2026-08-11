import { Classification } from '@control-tower/shared-types';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRuleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority!: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsString()
  @IsNotEmpty()
  strategy!: string;

  @IsObject()
  ruleDefinition!: Record<string, unknown>;

  @IsEnum(Classification)
  outcome!: Classification;
}

export class UpdateRuleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  strategy?: string;

  @IsOptional()
  @IsObject()
  ruleDefinition?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(Classification)
  outcome?: Classification;
}

export class RulePreviewDto {
  @IsString()
  @IsNotEmpty()
  strategy!: string;

  @IsObject()
  ruleDefinition!: Record<string, unknown>;

  @IsEnum(Classification)
  outcome!: Classification;

  @IsObject()
  sampleOrder!: Record<string, unknown>;
}
