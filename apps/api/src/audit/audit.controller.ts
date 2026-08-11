import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@control-tower/shared-types';
import { Roles } from '../auth/roles.decorator';
import { AuditService } from './audit.service';
import { PaginationQuery } from '../common/pagination.dto';
import { IsOptional, IsString } from 'class-validator';

class AuditQuery extends PaginationQuery {
  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  action?: string;
}

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Roles(Role.VIEWER)
  list(@Query() query: AuditQuery) {
    return this.audit.list({
      entityType: query.entityType,
      entityId: query.entityId,
      action: query.action,
      page: query.page,
      pageSize: query.pageSize,
    });
  }
}
