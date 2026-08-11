import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Classification, EVENTS, OrderClassifiedEvent } from '@control-tower/shared-types';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Maintains daily_aggregates from classification events ("updates aggregates"
 * pipeline step). recompute() rebuilds the table from the orders table —
 * used after bulk changes or to backfill.
 */
@Injectable()
export class AggregatesService {
  private readonly logger = new Logger(AggregatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  private today(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  @OnEvent(EVENTS.ORDER_CLASSIFIED)
  @OnEvent(EVENTS.ORDER_RECLASSIFIED)
  async onClassified(event: OrderClassifiedEvent) {
    try {
      const date = this.today();
      await this.prisma.dailyAggregate.upsert({
        where: { date_classification: { date, classification: event.classification } },
        create: { date, classification: event.classification, count: 1 },
        update: { count: { increment: 1 } },
      });
      if (
        event.previousClassification &&
        event.previousClassification !== event.classification
      ) {
        await this.prisma.dailyAggregate.updateMany({
          where: {
            date,
            classification: event.previousClassification,
            count: { gt: 0 },
          },
          data: { count: { decrement: 1 } },
        });
      }
    } catch (error) {
      this.logger.error(`Aggregate update failed: ${error}`);
    }
  }

  /** Rebuild aggregates from current order state. */
  async recompute(): Promise<number> {
    const groups = await this.prisma.order.groupBy({
      by: ['classification'],
      _count: { _all: true },
      where: { classification: { not: null } },
    });
    const date = this.today();
    for (const group of groups) {
      const classification = group.classification as Classification;
      await this.prisma.dailyAggregate.upsert({
        where: { date_classification: { date, classification } },
        create: { date, classification, count: group._count._all },
        update: { count: group._count._all },
      });
    }
    return groups.length;
  }
}
