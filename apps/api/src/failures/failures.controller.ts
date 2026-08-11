import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiUser, FailureCategory, Role } from '@control-tower/shared-types';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { PaginationQuery } from '../common/pagination.dto';
import { FailuresService } from './failures.service';

class ListFailuresQuery extends PaginationQuery {
  @IsOptional()
  @IsEnum(FailureCategory)
  category?: FailureCategory;

  @IsOptional()
  @IsString()
  owner?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeResolved?: boolean;
}

class ResolveFailureDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class ReassignDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  ids!: string[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  owner!: string;
}

@ApiTags('failures')
@ApiBearerAuth()
@Controller('failures')
export class FailuresController {
  constructor(private readonly failures: FailuresService) {}

  @Get()
  @Roles(Role.VIEWER)
  list(@Query() query: ListFailuresQuery) {
    return this.failures.list({
      page: query.page,
      pageSize: query.pageSize,
      category: query.category,
      owner: query.owner,
      search: query.search,
      includeResolved: query.includeResolved,
    });
  }

  @Get('breakdown')
  @Roles(Role.VIEWER)
  breakdown() {
    return this.failures.breakdown();
  }

  @Post(':id/resolve')
  @Roles(Role.OPERATOR)
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveFailureDto,
    @CurrentUser() user: ApiUser,
  ) {
    return this.failures.resolve(id, user.name, dto.note);
  }

  @Post('reassign')
  @Roles(Role.OPERATOR)
  reassign(@Body() dto: ReassignDto, @CurrentUser() user: ApiUser) {
    return this.failures.reassign(dto.ids, dto.owner, user.name);
  }

  @Post('resync')
  @Roles(Role.OPERATOR)
  resync() {
    return this.failures.syncOrderSummaries();
  }
}
