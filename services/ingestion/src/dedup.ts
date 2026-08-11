import { NormalizedOrder } from './types';

/** Natural key used for deduplication: (orderNumber, productCode), case-insensitive. */
export function dedupKey(order: Pick<NormalizedOrder, 'orderNumber' | 'productCode'>): string {
  return `${order.orderNumber.trim().toLowerCase()}::${order.productCode.trim().toLowerCase()}`;
}

export interface DedupResult {
  /** Last occurrence wins within a single file (later rows are fresher). */
  unique: NormalizedOrder[];
  duplicates: Array<{ key: string; occurrences: number }>;
}

/** Collapse in-file duplicates before hitting the database. */
export function dedupeWithinBatch(orders: NormalizedOrder[]): DedupResult {
  const map = new Map<string, NormalizedOrder>();
  const counts = new Map<string, number>();

  for (const order of orders) {
    const key = dedupKey(order);
    map.set(key, order);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const duplicates = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key, occurrences]) => ({ key, occurrences }));

  return { unique: [...map.values()], duplicates };
}

/** Fields compared when deciding whether an existing order actually changed. */
export const COMPARABLE_FIELDS: (keyof NormalizedOrder)[] = [
  'sourceOrderId',
  'customerId',
  'customerName',
  'productName',
  'orderStatus',
  'orderState',
  'quantity',
  'value',
  'orderDate',
];

export function changedFields(
  existing: Partial<Record<keyof NormalizedOrder, unknown>>,
  incoming: NormalizedOrder,
): string[] {
  return COMPARABLE_FIELDS.filter((field) => {
    const a = existing[field];
    const b = incoming[field];
    const norm = (v: unknown) => {
      if (v === null || v === undefined || v === '') return null;
      if (v instanceof Date) return v.toISOString();
      if (typeof v === 'number') return String(v);
      // Prisma Decimal and date strings
      const s = String(v);
      const d = new Date(s);
      if (field === 'orderDate' && !Number.isNaN(d.getTime())) return d.toISOString();
      if (!Number.isNaN(Number(s)) && s.trim() !== '') return String(Number(s));
      return s;
    };
    return norm(a) !== norm(b);
  });
}
