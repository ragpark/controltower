import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ParsedFailure } from '@control-tower/ingestion';
import { AuditAction, FailureCategory } from '@control-tower/shared-types';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

export interface FailureImportSummary {
  received: number;
  created: number;
  updated: number;
  autoResolved: number;
  linkedOrders: number;
  unmatchedOrderNumbers: string[];
}

@Injectable()
export class FailuresService {
  private readonly logger = new Logger(FailuresService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Apply a daily failure report.
   *
   * The report is a snapshot of that day's failures, not a list of everything
   * still outstanding, so a failure missing from today's report is NOT treated
   * as fixed. Resolution comes from evidence instead: either an operator
   * resolves it, or every order line for that order number reconciles with
   * Licence Manager.
   */
  async applyReport(
    failures: ParsedFailure[],
    actor: string,
    importRunId?: string,
  ): Promise<FailureImportSummary> {
    let created = 0;
    let updated = 0;
    const now = new Date();

    for (const failure of failures) {
      const existing = await this.prisma.provisioningFailure.findUnique({
        where: {
          orderNumber_contractNumber: {
            orderNumber: failure.orderNumber,
            contractNumber: failure.contractNumber,
          },
        },
      });

      if (existing) {
        await this.prisma.provisioningFailure.update({
          where: { id: existing.id },
          data: {
            rawMessage: failure.rawMessage,
            category: failure.category,
            // owner is deliberately not overwritten — it may have been
            // reassigned by hand, and a re-import must not undo that.
            suggestedAction: failure.suggestedAction,
            orderDate: failure.orderDate,
            lastSeenAt: now,
            occurrences: { increment: 1 },
            // a failure reported again is, by definition, not resolved
            resolvedAt: null,
            resolvedBy: null,
            importRunId,
          },
        });
        updated += 1;
      } else {
        await this.prisma.provisioningFailure.create({
          data: {
            orderNumber: failure.orderNumber,
            contractNumber: failure.contractNumber,
            orderDate: failure.orderDate,
            rawMessage: failure.rawMessage,
            category: failure.category,
            owner: failure.owner,
            suggestedAction: failure.suggestedAction,
            firstSeenAt: now,
            lastSeenAt: now,
            importRunId,
          },
        });
        created += 1;
      }
    }

    const autoResolved = await this.autoResolveReconciled(actor);
    const { linkedOrders, unmatchedOrderNumbers } = await this.syncOrderSummaries(
      failures.map((f) => f.orderNumber),
    );

    await this.audit.record({
      entityType: 'provisioning_failure',
      entityId: importRunId ?? 'report',
      action: AuditAction.IMPORT,
      changedBy: actor,
      changes: { received: failures.length, created, updated, autoResolved },
    });

    return {
      received: failures.length,
      created,
      updated,
      autoResolved,
      linkedOrders,
      unmatchedOrderNumbers,
    };
  }

  /**
   * Close failures whose order has since provisioned successfully — every
   * matching order line reconciled with Licence Manager. Conservative on
   * purpose: a partially reconciled order stays open.
   */
  async autoResolveReconciled(actor: string): Promise<number> {
    const open = await this.prisma.provisioningFailure.findMany({
      where: { resolvedAt: null },
      select: { id: true, orderNumber: true },
    });
    if (open.length === 0) return 0;

    const orderNumbers = [...new Set(open.map((f) => f.orderNumber))];
    const orders = await this.prisma.order.findMany({
      where: { orderNumber: { in: orderNumbers } },
      select: { orderNumber: true, licenceOrderMatch: true },
    });

    const byNumber = new Map<string, string[]>();
    for (const order of orders) {
      const list = byNumber.get(order.orderNumber) ?? [];
      list.push((order.licenceOrderMatch ?? '').trim().toLowerCase());
      byNumber.set(order.orderNumber, list);
    }

    const resolvable = open
      .filter((f) => {
        const flags = byNumber.get(f.orderNumber);
        return Boolean(flags?.length) && flags!.every((flag) => flag === 'match');
      })
      .map((f) => f.id);

    if (resolvable.length === 0) return 0;

    const { count } = await this.prisma.provisioningFailure.updateMany({
      where: { id: { in: resolvable } },
      data: {
        resolvedAt: new Date(),
        resolvedBy: 'system',
        resolutionNote: 'Licence Manager now matches every line for this order',
      },
    });
    this.logger.log(`Auto-resolved ${count} provisioning failure(s) after reconciliation`);
    return count;
  }

  /**
   * Refresh the denormalised provisioning summary on orders. Failures may be
   * reported before the order is imported, so this also runs after order
   * imports to link records that arrived out of order.
   */
  async syncOrderSummaries(
    orderNumbers?: string[],
  ): Promise<{ linkedOrders: number; unmatchedOrderNumbers: string[] }> {
    const scope = orderNumbers?.length ? [...new Set(orderNumbers)] : undefined;

    // Clear summaries in scope, then re-apply from the open failures.
    await this.prisma.order.updateMany({
      where: scope ? { orderNumber: { in: scope } } : {},
      data: { provisioningCategory: null, provisioningOwner: null, provisioningFailedAt: null },
    });

    const open = await this.prisma.provisioningFailure.findMany({
      where: {
        resolvedAt: null,
        ...(scope ? { orderNumber: { in: scope } } : {}),
      },
      orderBy: { lastSeenAt: 'asc' },
    });

    let linkedOrders = 0;
    const unmatched: string[] = [];

    for (const failure of open) {
      const { count } = await this.prisma.order.updateMany({
        where: { orderNumber: failure.orderNumber },
        data: {
          provisioningCategory: failure.category,
          provisioningOwner: failure.owner,
          provisioningFailedAt: failure.orderDate ?? failure.firstSeenAt,
        },
      });
      if (count === 0) unmatched.push(failure.orderNumber);
      linkedOrders += count;
    }

    return { linkedOrders, unmatchedOrderNumbers: [...new Set(unmatched)] };
  }

  async list(params: {
    page: number;
    pageSize: number;
    category?: FailureCategory;
    owner?: string;
    search?: string;
    includeResolved?: boolean;
  }) {
    const where: Prisma.ProvisioningFailureWhereInput = {
      ...(params.includeResolved ? {} : { resolvedAt: null }),
      ...(params.category ? { category: params.category } : {}),
      ...(params.owner ? { owner: params.owner } : {}),
      ...(params.search
        ? {
            OR: [
              { orderNumber: { contains: params.search, mode: 'insensitive' } },
              { contractNumber: { contains: params.search, mode: 'insensitive' } },
              { rawMessage: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.provisioningFailure.findMany({
        where,
        orderBy: [{ resolvedAt: 'asc' }, { lastSeenAt: 'desc' }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.provisioningFailure.count({ where }),
    ]);

    // Attach the order lines each failure covers (join is by order number).
    const orders = await this.prisma.order.findMany({
      where: { orderNumber: { in: items.map((i) => i.orderNumber) } },
      select: {
        id: true,
        orderNumber: true,
        productCode: true,
        productName: true,
        customerName: true,
        classification: true,
        licenceOrderMatch: true,
      },
    });

    return {
      items: items.map((failure) => ({
        ...failure,
        matchedOrders: orders
          .filter((o) => o.orderNumber === failure.orderNumber)
          .map(({ orderNumber: _orderNumber, ...rest }) => rest),
      })),
      total,
      page: params.page,
      pageSize: params.pageSize,
    };
  }

  /** Open failures grouped by the team that owns the next step. */
  async breakdown() {
    // Two independent reads — no transaction needed, and groupBy keeps its
    // inferred result type when called directly.
    const byOwner = await this.prisma.provisioningFailure.groupBy({
      by: ['owner'],
      where: { resolvedAt: null },
      _count: { _all: true },
    });
    const byCategory = await this.prisma.provisioningFailure.groupBy({
      by: ['category'],
      where: { resolvedAt: null },
      _count: { _all: true },
    });

    return {
      byOwner: byOwner
        .map((g) => ({ key: g.owner, label: g.owner, count: g._count._all }))
        .sort((a, b) => b.count - a.count),
      byCategory: byCategory
        .map((g) => ({ key: g.category, label: g.category, count: g._count._all }))
        .sort((a, b) => b.count - a.count),
    };
  }

  forOrderNumber(orderNumber: string) {
    return this.prisma.provisioningFailure.findMany({
      where: { orderNumber },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  async resolve(id: string, actor: string, note?: string) {
    const failure = await this.prisma.provisioningFailure.findUnique({ where: { id } });
    if (!failure) throw new NotFoundException('Provisioning failure not found');

    const updated = await this.prisma.provisioningFailure.update({
      where: { id },
      data: { resolvedAt: new Date(), resolvedBy: actor, resolutionNote: note ?? null },
    });
    await this.syncOrderSummaries([failure.orderNumber]);
    await this.audit.record({
      entityType: 'provisioning_failure',
      entityId: id,
      action: AuditAction.UPDATE,
      changedBy: actor,
      changes: { resolved: true, note },
    });
    return updated;
  }

  async reassign(ids: string[], owner: string, actor: string) {
    const { count } = await this.prisma.provisioningFailure.updateMany({
      where: { id: { in: ids } },
      data: { owner },
    });
    const affected = await this.prisma.provisioningFailure.findMany({
      where: { id: { in: ids } },
      select: { orderNumber: true },
    });
    await this.syncOrderSummaries(affected.map((f) => f.orderNumber));
    await this.audit.record({
      entityType: 'provisioning_failure',
      entityId: 'bulk',
      action: AuditAction.BULK_UPDATE,
      changedBy: actor,
      changes: { ids, owner },
    });
    return { affected: count };
  }
}
