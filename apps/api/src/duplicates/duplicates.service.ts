import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
   * CSV of the duplicate report (FR-21).
   *
   * The report is built from identifiers, timestamps and provenance only —
   * customer_name and customer_email are not in CANDIDATE_SELECT and so cannot
   * reach the file. That is the acceptance criterion, and it is enforced by
   * what the query selects rather than by filtering afterwards.
   */
  async exportCsv(): Promise<string> {
    const report = await this.report();
    const header = [
      'group_key',
      'order_number',
      'product_code',
      'disposition',
      'classification',
      'order_status',
      'imported_at',
      'source_file',
      'import_run_id',
      'order_id',
    ];
    const escape = (value: string | null) => {
      const v = value ?? '';
      return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    };
    const rows = report.groups.flatMap((group) =>
      group.variants.map((v) =>
        [
          group.key,
          v.orderNumber,
          v.productCode,
          v.survivor ? 'keep' : 'remove',
          v.classification,
          v.orderStatus,
          v.importedAt,
          v.sourceFile,
          v.importRunId,
          v.id,
        ]
          .map((c) => escape(c as string | null))
          .join(','),
      ),
    );
    return [header.join(','), ...rows].join('\n');
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
      //
      // Serializable, and the plan is recomputed inside the boundary. The
      // planning read above is not locked, so a scheduled or concurrent import
      // can land between it and this write and make a row marked for deletion
      // the freshest one. Deleting the row we promised to keep is the one
      // outcome this operation must never produce, so the survivor is
      // revalidated against the same snapshot that performs the delete.
      const counts = await this.prisma.$transaction(async (tx) => {
        const current = await tx.order.findMany({
          where: {
            orderNumber: { equals: plan.survivor.orderNumber, mode: 'insensitive' },
            productCode: { equals: plan.survivor.productCode, mode: 'insensitive' },
          },
          select: CANDIDATE_SELECT,
        });
        const [revalidated] = planDuplicateResolution(current);

        const unchanged =
          revalidated !== undefined &&
          revalidated.survivor.id === plan.survivor.id &&
          revalidated.superseded.length === plan.superseded.length &&
          revalidated.superseded.every((r) => supersededIds.includes(r.id));

        if (!unchanged) {
          throw new ConflictException(
            `Duplicate group "${plan.key}" changed while it was being resolved — ` +
              'an import has touched these order lines. Nothing was removed for this group. ' +
              'Reload the report and try again.',
          );
        }

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
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

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
