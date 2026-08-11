import { Injectable } from '@nestjs/common';
import {
  buildTrend,
  computeOperationalHealth,
  TrendRow,
} from '@control-tower/reporting';
import {
  BreakdownItem,
  Classification,
  DashboardSummary,
  OperationalHealth,
  TrendGranularity,
} from '@control-tower/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(): Promise<DashboardSummary> {
    const groups = await this.prisma.order.groupBy({
      by: ['classification'],
      _count: { _all: true },
    });
    const byClassification = Object.fromEntries(
      Object.values(Classification).map((c) => [c, 0]),
    ) as Record<Classification, number>;
    let total = 0;
    let unclassified = 0;
    for (const group of groups) {
      total += group._count._all;
      if (group.classification === null) unclassified += group._count._all;
      else byClassification[group.classification as Classification] = group._count._all;
    }
    return { total, byClassification, unclassified };
  }

  async byStatus(): Promise<BreakdownItem[]> {
    const groups = await this.prisma.order.groupBy({
      by: ['classification'],
      _count: { _all: true },
    });
    return groups.map((g) => ({
      key: g.classification ?? 'UNCLASSIFIED',
      label: g.classification ?? 'Unclassified',
      count: g._count._all,
    }));
  }

  async byProduct(limit = 10): Promise<BreakdownItem[]> {
    const groups = await this.prisma.order.groupBy({
      by: ['productCode', 'productName'],
      _count: { _all: true },
      orderBy: { _count: { productCode: 'desc' } },
      take: limit,
    });
    return groups.map((g) => ({
      key: g.productCode,
      label: g.productName ?? g.productCode,
      count: g._count._all,
    }));
  }

  async bySource(): Promise<BreakdownItem[]> {
    const groups = await this.prisma.order.groupBy({
      by: ['sourceId'],
      _count: { _all: true },
    });
    const sources = await this.prisma.source.findMany({ select: { id: true, name: true } });
    const names = new Map(sources.map((s) => [s.id, s.name]));
    return groups.map((g) => ({
      key: g.sourceId ?? 'unknown',
      label: g.sourceId ? (names.get(g.sourceId) ?? 'Deleted source') : 'Unknown',
      count: g._count._all,
    }));
  }

  async trend(granularity: TrendGranularity, days: number) {
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - days);
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date();

    const rows = await this.prisma.$queryRaw<
      Array<{ day: Date; classification: Classification | null; count: bigint }>
    >`
      SELECT date_trunc('day', COALESCE(order_date, imported_at)) AS day,
             classification,
             COUNT(*)::bigint AS count
      FROM orders
      WHERE COALESCE(order_date, imported_at) >= ${from}
      GROUP BY 1, 2
      ORDER BY 1
    `;

    const trendRows: TrendRow[] = rows.map((r) => ({
      date: r.day,
      classification: r.classification,
      count: Number(r.count),
    }));
    return buildTrend(trendRows, granularity, { from, to });
  }

  async health(): Promise<OperationalHealth> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 30);

    const [runs, sources, missingCustomer, missingOrderDate, missingValue, unclassified] =
      await this.prisma.$transaction([
        this.prisma.importRun.findMany({
          where: { startTime: { gte: since } },
          select: { status: true, failedRows: true, startTime: true },
        }),
        this.prisma.source.findMany({
          select: { id: true, name: true, enabled: true, schedule: true, lastRunAt: true },
        }),
        this.prisma.order.count({ where: { customerName: null } }),
        this.prisma.order.count({ where: { orderDate: null } }),
        this.prisma.order.count({ where: { value: null } }),
        this.prisma.order.count({ where: { classification: null } }),
      ]);

    return computeOperationalHealth(
      runs,
      sources.map((s) => ({
        sourceId: s.id,
        sourceName: s.name,
        enabled: s.enabled,
        schedule: s.schedule,
        lastRunAt: s.lastRunAt,
      })),
      { missingCustomer, missingOrderDate, missingValue, unclassified },
    );
  }
}
