import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditAction } from '@control-tower/shared-types';
import { planDuplicateResolution, supersededCount } from '@control-tower/ingestion';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FailuresService } from '../failures/failures.service';

/** Columns needed to describe a duplicate group to an operator. */
const CANDIDATE_SELECT = {
  id: true,
  orderNumber: true,
  productCode: true,
  productName: true,
  orderStatus: true,
  classification: true,
  importedAt: true,
  createdAt: true,
  updatedAt: true,
  sourceFile: true,
  sourceId: true,
  importRunId: true,
} satisfies Prisma.OrderSelect;

export interface DuplicateVariantDto {
  id: string;
  orderNumber: string;
  productCode: string;
  productName: string | null;
  orderStatus: string | null;
  classification: string | null;
  importedAt: string;
  sourceFile: string | null;
  importRunId: string | null;
  /** True for the row that would be kept. */
  survivor: boolean;
}

export interface DuplicateGroupDto {
  key: string;
  orderNumber: string;
  productCode: string;
  variantCount: number;
  removableCount: number;
  variants: DuplicateVariantDto[];
}

export interface DuplicateReportDto {
  groups: DuplicateGroupDto[];
  groupCount: number;
  removableCount: number;
}

export interface ResolutionResultDto {
  groupsResolved: number;
  ordersRemoved: number;
  historyRowsReattached: number;
  ruleExecutionsReattached: number;
  ordersResynced: number;
}

@Injectable()
export class DuplicatesService {
  private readonly logger = new Logger(DuplicatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly failures: FailuresService,
  ) {}

  /**
   * Read-only duplicate report (FR-21).
   *
   * Groups order lines whose natural key differs only by letter case and
   * nominates the most recently imported row as the survivor. Writes nothing.
   */
  async report(): Promise<DuplicateReportDto> {
    const orders = await this.prisma.order.findMany({ select: CANDIDATE_SELECT });
    const plans = planDuplicateResolution(orders);

    return {
      groups: plans.map((plan) => {
        const variants = [plan.survivor, ...plan.superseded];
        return {
          key: plan.key,
          orderNumber: plan.survivor.orderNumber,
          productCode: plan.survivor.productCode,
          variantCount: variants.length,
          removableCount: plan.superseded.length,
          variants: variants.map((v) => ({
            id: v.id,
            orderNumber: v.orderNumber,
            productCode: v.productCode,
            productName: v.productName,
            orderStatus: v.orderStatus,
            classification: v.classification,
            importedAt: v.importedAt.toISOString(),
            sourceFile: v.sourceFile,
            importRunId: v.importRunId,
            survivor: v.id === plan.survivor.id,
          })),
        };
      }),
      groupCount: plans.length,
      removableCount: supersededCount(plans),
    };
  }

  /**
   * Remove superseded duplicate rows for the named groups (ENG-1104).
   *
   * The survivor is recomputed here rather than taken from the caller: a client
   * that had a stale report must not be able to nominate a row for deletion
   * that the current data would keep.
   *
   * Nothing is destroyed silently. order_history and rule_executions cascade on
   * order deletion, so both are re-pointed to the survivor first, and the
   * superseded row's own field values are snapshotted into the survivor's
   * history before it goes. The order line's past therefore survives the
   * removal, which is what makes this reversible in substance even though the
   * row itself is gone.
   */
  async resolve(keys: string[], actor: string): Promise<ResolutionResultDto> {
    const requested = new Set(keys);
    const orders = await this.prisma.order.findMany({ select: CANDIDATE_SELECT });
    const plans = planDuplicateResolution(orders).filter((p) => requested.has(p.key));

    const unknown = [...requested].filter((k) => !plans.some((p) => p.key === k));
    if (unknown.length > 0) {
      throw new NotFoundException(
        `No duplicate group found for ${unknown.map((k) => `"${k}"`).join(', ')}. ` +
          'The report may be stale — reload it and try again.',
      );
    }

    let ordersRemoved = 0;
    let historyRowsReattached = 0;
    let ruleExecutionsReattached = 0;
    const touchedOrderNumbers = new Set<string>();

    for (const plan of plans) {
      const supersededIds = plan.superseded.map((r) => r.id);

      // Each group is its own transaction: one bad group must not roll back
      // groups the operator already had confirmed as resolved.
      const counts = await this.prisma.$transaction(async (tx) => {
        const history = await tx.orderHistory.updateMany({
          where: { orderId: { in: supersededIds } },
          data: { orderId: plan.survivor.id },
        });
        const executions = await tx.ruleExecution.updateMany({
          where: { orderId: { in: supersededIds } },
          data: { orderId: plan.survivor.id },
        });

        // Snapshot the rows themselves before they are deleted.
        const removed = await tx.order.findMany({ where: { id: { in: supersededIds } } });
        await tx.orderHistory.createMany({
          data: removed.map((order) => ({
            orderId: plan.survivor.id,
            snapshot: order as unknown as Prisma.InputJsonValue,
            changedFields: ['__superseded_duplicate__'],
            importRunId: order.importRunId,
          })),
        });

        await tx.order.deleteMany({ where: { id: { in: supersededIds } } });

        return { history: history.count, executions: executions.count, removed: removed.length };
      });

      ordersRemoved += counts.removed;
      historyRowsReattached += counts.history;
      ruleExecutionsReattached += counts.executions;
      touchedOrderNumbers.add(plan.survivor.orderNumber);

      await this.audit.record({
        entityType: 'order',
        entityId: plan.survivor.id,
        action: AuditAction.DELETE,
        changedBy: actor,
        changes: {
          operation: 'duplicate_resolution',
          task: 'ENG-1104',
          key: plan.key,
          survivorId: plan.survivor.id,
          survivorImportedAt: plan.survivor.importedAt.toISOString(),
          survivorRule: 'most recently imported',
          removed: plan.superseded.map((r) => ({
            id: r.id,
            orderNumber: r.orderNumber,
            productCode: r.productCode,
            importedAt: r.importedAt.toISOString(),
          })),
          historyRowsReattached: counts.history,
          ruleExecutionsReattached: counts.executions,
        },
      });

      this.logger.log(
        `Resolved duplicate group ${plan.key}: kept ${plan.survivor.id}, removed ${counts.removed}`,
      );
    }

    // The denormalised provisioning summary is keyed on order number, so a
    // survivor may now need the summary that had been written to a row we removed.
    const resync =
      touchedOrderNumbers.size > 0 ? await this.failures.syncAndReclassify(undefined, actor) : null;

    return {
      groupsResolved: plans.length,
      ordersRemoved,
      historyRowsReattached,
      ruleExecutionsReattached,
      ordersResynced: resync?.reclassified ?? 0,
    };
  }
}
