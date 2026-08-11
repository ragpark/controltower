import { Classification, TrendBucket, TrendGranularity } from '@control-tower/shared-types';

export interface TrendRow {
  date: Date | string;
  classification: Classification | null;
  count: number;
}

/** UTC start of the bucket containing `date`. Weeks start Monday. */
export function bucketStart(date: Date, granularity: TrendGranularity): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  if (granularity === 'weekly') {
    const day = d.getUTCDay(); // 0 = Sunday
    const diff = day === 0 ? 6 : day - 1;
    d.setUTCDate(d.getUTCDate() - diff);
  } else if (granularity === 'monthly') {
    d.setUTCDate(1);
  }
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function nextBucket(d: Date, granularity: TrendGranularity): Date {
  const n = new Date(d);
  if (granularity === 'daily') n.setUTCDate(n.getUTCDate() + 1);
  else if (granularity === 'weekly') n.setUTCDate(n.getUTCDate() + 7);
  else n.setUTCMonth(n.getUTCMonth() + 1);
  return n;
}

/**
 * Roll per-day classification counts into contiguous trend buckets
 * (gaps filled with zeroes so charts render continuous axes).
 */
export function buildTrend(
  rows: TrendRow[],
  granularity: TrendGranularity,
  range?: { from: Date; to: Date },
): TrendBucket[] {
  const buckets = new Map<string, TrendBucket>();

  const ensure = (key: string): TrendBucket => {
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { bucket: key, total: 0, byClassification: {} };
      buckets.set(key, bucket);
    }
    return bucket;
  };

  for (const row of rows) {
    const date = row.date instanceof Date ? row.date : new Date(row.date);
    if (Number.isNaN(date.getTime())) continue;
    const key = isoDate(bucketStart(date, granularity));
    const bucket = ensure(key);
    bucket.total += row.count;
    if (row.classification) {
      bucket.byClassification[row.classification] =
        (bucket.byClassification[row.classification] ?? 0) + row.count;
    }
  }

  if (range) {
    for (
      let cursor = bucketStart(range.from, granularity);
      cursor <= range.to;
      cursor = nextBucket(cursor, granularity)
    ) {
      ensure(isoDate(cursor));
    }
  }

  return [...buckets.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
}
