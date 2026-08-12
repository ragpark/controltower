import { Classification } from '@control-tower/shared-types';
import { summariseTrend } from '../summary';

const buckets = [
  {
    bucket: '2026-08-01',
    total: 5,
    byClassification: { [Classification.COMPLETED]: 3, [Classification.PENDING]: 2 },
  },
  {
    bucket: '2026-08-02',
    total: 4,
    byClassification: { [Classification.COMPLETED]: 1, [Classification.EXCEPTION]: 1 },
  },
  { bucket: '2026-08-03', total: 0, byClassification: {} },
];

describe('summariseTrend', () => {
  it('totals each classification across the window', () => {
    const summary = summariseTrend(buckets);
    expect(summary.byClassification[Classification.COMPLETED]).toBe(4);
    expect(summary.byClassification[Classification.PENDING]).toBe(2);
    expect(summary.byClassification[Classification.EXCEPTION]).toBe(1);
  });

  // The bucket total includes unclassified orders, so it must not be
  // reconstructed by summing the per-classification counts.
  it('total counts unclassified orders that no classification bucket holds', () => {
    const summary = summariseTrend(buckets);
    expect(summary.total).toBe(9);
    const classified = Object.values(summary.byClassification).reduce((a, b) => a + b, 0);
    expect(classified).toBe(7);
  });

  it('reports zero for classifications absent from the window', () => {
    const summary = summariseTrend(buckets);
    expect(summary.byClassification[Classification.CANCELLED]).toBe(0);
    expect(summary.byClassification[Classification.CUSTOMER_IMPACTED]).toBe(0);
  });

  it('returns the first and last bucket keys for labelling', () => {
    const summary = summariseTrend(buckets);
    expect(summary.from).toBe('2026-08-01');
    expect(summary.to).toBe('2026-08-03');
  });

  it('is stable regardless of bucket order', () => {
    const shuffled = [buckets[2], buckets[0], buckets[1]];
    expect(summariseTrend(shuffled)).toEqual(summariseTrend(buckets));
  });

  it('handles an empty window', () => {
    const summary = summariseTrend([]);
    expect(summary.total).toBe(0);
    expect(summary.from).toBeNull();
    expect(summary.byClassification[Classification.COMPLETED]).toBe(0);
  });
});
