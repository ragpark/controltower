import { Classification, TrendBucket } from '@control-tower/shared-types';

export interface TrendSummary {
  total: number;
  byClassification: Record<Classification, number>;
  /** Bucket keys at each end of the window, for labelling. */
  from: string | null;
  to: string | null;
}

/**
 * Totals for the window the trend chart is currently showing.
 *
 * Derived from the same buckets the chart renders rather than queried
 * separately, so the headline figures can never disagree with the bars above
 * them. `total` includes unclassified orders, which is why it is taken from
 * each bucket's own total rather than summing the per-classification counts.
 */
export function summariseTrend(buckets: TrendBucket[]): TrendSummary {
  const byClassification = Object.fromEntries(
    Object.values(Classification).map((c) => [c, 0]),
  ) as Record<Classification, number>;

  let total = 0;
  for (const bucket of buckets) {
    total += bucket.total;
    for (const [classification, count] of Object.entries(bucket.byClassification)) {
      byClassification[classification as Classification] += count ?? 0;
    }
  }

  const sorted = [...buckets].map((b) => b.bucket).sort();
  return {
    total,
    byClassification,
    from: sorted[0] ?? null,
    to: sorted[sorted.length - 1] ?? null,
  };
}
