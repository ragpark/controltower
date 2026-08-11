import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@control-tower/shared-types';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Roles } from '../auth/roles.decorator';
import { DashboardService } from './dashboard.service';

class TrendQuery {
  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly'])
  granularity: 'daily' | 'weekly' | 'monthly' = 'daily';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(366)
  days = 30;
}

class LimitQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;
}

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  @Roles(Role.VIEWER)
  summary() {
    return this.dashboard.summary();
  }

  @Get('by-status')
  @Roles(Role.VIEWER)
  byStatus() {
    return this.dashboard.byStatus();
  }

  @Get('by-product')
  @Roles(Role.VIEWER)
  byProduct(@Query() query: LimitQuery) {
    return this.dashboard.byProduct(query.limit);
  }

  @Get('by-source')
  @Roles(Role.VIEWER)
  bySource() {
    return this.dashboard.bySource();
  }

  @Get('trend')
  @Roles(Role.VIEWER)
  trend(@Query() query: TrendQuery) {
    return this.dashboard.trend(query.granularity, query.days);
  }

  @Get('health')
  @Roles(Role.VIEWER)
  health() {
    return this.dashboard.health();
  }
}
