import { Controller, Get, Header, ServiceUnavailableException, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../observability/metrics.service';

@ApiTags('ops')
@Controller({ path: '/', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
  ) {}

  @Public()
  @Get('healthz')
  healthz() {
    return { status: 'ok', uptime: process.uptime() };
  }

  @Public()
  @Get('readyz')
  async readyz() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', database: 'up' };
    } catch {
      throw new ServiceUnavailableException({ status: 'not-ready', database: 'down' });
    }
  }

  @Public()
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4')
  metrics() {
    return this.metricsService.metrics();
  }
}
