import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ParsedFailure } from '@control-tower/ingestion';
import { AuditAction, FailureCategory } from '@control-tower/shared-types';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClassificationService } from '../rules/classification.service';

/**
 * Order numbers join failures to orders. The same order number can be stored
 * in different letter cases (DEF-01), so the join must normalise or it links
 * nothing — and a full resync would then clear summaries that should stand.
 */
function normaliseOrderNumber(orderNumber: string): string {
  return orderNumber.trim().toLowerCase();
}

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
    private readonly classification: ClassificationService,
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
    const { linkedOrders, unmatchedOrderNumbers } = await this.syncAndReclassify(
      failures.map((f) => f.orderNumber),
      actor,
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
   * Close failures whose order has since provisioned successfully.
   *
   * Two conditions, both required. Every matching order line must reconcile
   * with Licence Manager — a partially reconciled order stays open. And that
   * reconciliation must be *newer* than the failure report, compared against
   * `importedAt` rather than `updatedAt`: writing the provisioning summary
   * touches `updatedAt`, so using it would let this method resolve failures on
   * the strength of its own writes. The recency check is also what stops a
   * failure reported moments ago being closed by stale order data.
   */
  async autoResolveReconciled(actor: string): Promise<number> {
    const open = await this.prisma.provisioningFailure.findMany({
      where: { resolvedAt: null },
      select: { id: true, orderNumber: true, lastSeenAt: true },
    });
    if (open.length === 0) return 0;

    const orderNumbers = [...new Set(open.map((f) => f.orderNumber))];
    const orders = await this.prisma.order.findMany({
      where: { orderNumber: { in: orderNumbers } },
      select: { orderNumber: true, licenceOrderMatch: true, importedAt: true },
    });

    const byNumber = new Map<string, Array<{ matched: boolean; importedAt: Date }>>();
    for (const order of orders) {
      const list = byNumber.get(order.orderNumber) ?? [];
      list.push({
        matched: (order.licenceOrderMatch ?? '').trim().toLowerCase() === 'match',
        importedAt: order.importedAt,
      });
      byNumber.set(order.orderNumber, list);
    }

    const resolvable = open
      .filter((f) => {
        const lines = byNumber.get(f.orderNumber);
        if (!lines?.length) return false;
        return lines.every(
          (line) => line.matched && line.importedAt.getTime() > f.lastSeenAt.getTime(),
        );
      })
      .map((f) => f.id);

    if (resolvable.length === 0) return 0;

    const { count } = await this.prisma.provisioningFailure.updateMany({
      where: { id: { in: resolvable } },
      data: {
        resolvedAt: new Date(),
        resolvedBy: 'system',
        resolutionNote:
          'Licence Manager matched every line for this order in an import taken after the failure was last reported',
      },
    });
    this.logger.log(
      `Auto-resolved ${count} provisioning failure(s) after reconciliation (actor=${actor})`,
    );
    return count;
  }

  /**
   * Refresh the denormalised provisioning summary on orders. Failures may be
   * reported before the order is imported, so this also runs after order
   * imports to link records that arrived out of order.
   */
  async syncOrderSummaries(orderNumbers?: string[]): Promise<{
    linkedOrders: number;
    unmatchedOrderNumbers: string[];
    changedOrderIds: string[];
  }> {
    const scope = orderNumbers?.length ? [...new Set(orderNumbers)] : undefined;

    const open = await this.prisma.provisioningFailure.findMany({
      where: { resolvedAt: null, ...(scope ? { orderNumber: { in: scope } } : {}) },
      orderBy: { lastSeenAt: 'desc' },
    });

    // Most recently reported open failure wins for the order's summary.
    //
    // Keyed case-insensitively (DEF-02). Failures join to orders by order
    // number, and the same order number can be stored in different cases —
    // that is DEF-01. An exact-match join silently fails to link, and worse,
    // the full-resync branch below then CLEARS a summary the order should
    // still carry and reclassifies it out of Customer Impacted.
    const desired = new Map<
      string,
      { category: FailureCategory; owner: string; failedAt: Date }
    >();
    for (const failure of open) {
      const key = normaliseOrderNumber(failure.orderNumber);
      if (desired.has(key)) continue;
      desired.set(key, {
        category: failure.category as FailureCategory,
        owner: failure.owner,
        failedAt: failure.orderDate ?? failure.firstSeenAt,
      });
    }

    // Orders to reconcile: those in scope, or — for a full resync — orders that
    // either have an open failure or still carry a summary that must be cleared.
    const orders = await this.prisma.order.findMany({
      where: scope
        ? { OR: scope.map((n) => ({ orderNumber: { equals: n, mode: 'insensitive' as const } })) }
        : {
            OR: [
              ...open.map((f) => ({
                orderNumber: { equals: f.orderNumber, mode: 'insensitive' as const },
              })),
              { provisioningCategory: { not: null } },
            ],
          },
      select: {
        id: true,
        orderNumber: true,
        provisioningCategory: true,
        provisioningOwner: true,
        provisioningFailedAt: true,
      },
    });

    const changedOrderIds: string[] = [];
    const matchedNumbers = new Set<string>();
    let linkedOrders = 0;

    for (const order of orders) {
      const target = desired.get(normaliseOrderNumber(order.orderNumber)) ?? null;
      if (target) {
        matchedNumbers.add(normaliseOrderNumber(order.orderNumber));
        linkedOrders += 1;
      }

      const unchanged =
        (order.provisioningCategory ?? null) === (target?.category ?? null) &&
        (order.provisioningOwner ?? null) === (target?.owner ?? null) &&
        (order.provisioningFailedAt?.getTime() ?? null) === (target?.failedAt.getTime() ?? null);
      if (unchanged) continue;

      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          provisioningCategory: target?.category ?? null,
          provisioningOwner: target?.owner ?? null,
          provisioningFailedAt: target?.failedAt ?? null,
        },
      });
      changedOrderIds.push(order.id);
    }

    // Report the numbers as the failures spell them, not as normalised keys.
    const spelling = new Map(open.map((f) => [normaliseOrderNumber(f.orderNumber), f.orderNumber]));
    const unmatchedOrderNumbers = [...desired.keys()]
      .filter((n) => !matchedNumbers.has(n))
      .map((n) => spelling.get(n) ?? n);
    return { linkedOrders, unmatchedOrderNumbers, changedOrderIds };
  }

  /**
   * Sync the summaries and re-run classification for the orders whose
   * provisioning state actually changed. Without this the priority-15
   * provisioning rule would never be applied to persisted data — an order would
   * keep its previous classification and trace until someone re-ran the rules
   * by hand, and resolving a failure would not move it back out of the queue.
   */
  async syncAndReclassify(orderNumbers: string[] | undefined, actor: string): Promise<{
    linkedOrders: number;
    unmatchedOrderNumbers: string[];
    reclassified: number;
  }> {
    const { linkedOrders, unmatchedOrderNumbers, changedOrderIds } =
      await this.syncOrderSummaries(orderNumbers);

    const reclassified =
      changedOrderIds.length > 0
        ? await this.classification.reapply(changedOrderIds, actor)
        : 0;

    return { linkedOrders, unmatchedOrderNumbers, reclassified };
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
    await this.syncAndReclassify([failure.orderNumber], actor);
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
    await this.syncAndReclassify(
      affected.map((f) => f.orderNumber),
      actor,
    );
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
