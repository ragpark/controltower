import { dedupKey } from './dedup';

/**
 * Duplicate order lines that the database could not prevent.
 *
 * The natural key is (order_number, product_code) and it is a unique
 * constraint, so byte-identical duplicates cannot exist. What can exist is two
 * rows whose keys differ only by letter case: `dedupKey()` collapses those
 * in-batch, but the cross-import lookup queries the unique index with the raw
 * values and Postgres text equality is exact (DEF-01).
 *
 * This module decides which row survives. It performs no writes and knows
 * nothing about Prisma or Nest, so the survivor rule is testable without a
 * database.
 */

/** The subset of an order this module needs in order to choose a survivor. */
export interface DuplicateCandidate {
  id: string;
  orderNumber: string;
  productCode: string;
  /** Import recency — the survivor rule's primary discriminator. */
  importedAt: Date;
  /** Tie-break when two rows were imported in the same run. */
  createdAt: Date;
}

export interface DuplicateGroup<T extends DuplicateCandidate = DuplicateCandidate> {
  /** Case-insensitive natural key shared by every row in the group. */
  key: string;
  /** The row to keep: most recently imported. */
  survivor: T;
  /** Rows to remove, newest first. */
  superseded: T[];
}

/**
 * Order two candidates so the survivor sorts first.
 *
 * Most recent `importedAt` wins, as instructed: the freshest import carries the
 * most current values for the order line. Ties are broken deterministically —
 * two rows imported in the same run have the same `importedAt`, and picking
 * arbitrarily would make the operation non-reproducible, so `createdAt` then
 * `id` decide it. The comparator is total, which matters: the same input must
 * always produce the same survivor, or a dry run tells you nothing about what
 * the real run will do.
 */
function bySurvivorPreference(a: DuplicateCandidate, b: DuplicateCandidate): number {
  const imported = b.importedAt.getTime() - a.importedAt.getTime();
  if (imported !== 0) return imported;
  const created = b.createdAt.getTime() - a.createdAt.getTime();
  if (created !== 0) return created;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Group order lines by their case-insensitive natural key and nominate a
 * survivor for each group that has more than one row.
 *
 * Groups of one are not duplicates and are never returned. Rows that differ by
 * product code are never grouped, because the product code is part of the key —
 * a multi-line order (one order number, several products) is correct data, and
 * collapsing it would destroy real order lines.
 */
export function planDuplicateResolution<T extends DuplicateCandidate>(
  orders: T[],
): DuplicateGroup<T>[] {
  const groups = new Map<string, T[]>();

  for (const order of orders) {
    const key = dedupKey(order);
    const existing = groups.get(key);
    if (existing) existing.push(order);
    else groups.set(key, [order]);
  }

  const plans: DuplicateGroup<T>[] = [];
  for (const [key, rows] of groups) {
    if (rows.length < 2) continue;
    const ordered = [...rows].sort(bySurvivorPreference);
    const [survivor, ...superseded] = ordered;
    plans.push({ key, survivor, superseded });
  }

  // Stable output so the diagnostics view and the resolve call agree on order.
  return plans.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** Total rows that would be removed by executing every plan. */
export function supersededCount(plans: DuplicateGroup[]): number {
  return plans.reduce((total, plan) => total + plan.superseded.length, 0);
}
