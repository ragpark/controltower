import { Classification } from '@control-tower/shared-types';
import { bucketStart, buildTrend } from '../trends';

describe('bucketStart', () => {
  const date = new Date('2026-08-11T15:30:00Z'); // a Tuesday

  it('daily → midnight UTC of the same day', () => {
    expect(bucketStart(date, 'daily').toISOString()).toBe('2026-08-11T00:00:00.000Z');
  });

  it('weekly → the preceding Monday', () => {
    expect(bucketStart(date, 'weekly').toISOString()).toBe('2026-08-10T00:00:00.000Z');
    // Sunday rolls back to the previous Monday
    expect(bucketStart(new Date('2026-08-09T10:00:00Z'), 'weekly').toISOString()).toBe(
      '2026-08-03T00:00:00.000Z',
    );
  });

  it('monthly → first of the month', () => {
    expect(bucketStart(date, 'monthly').toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });
});

describe('buildTrend', () => {
  const rows = [
    { date: '2026-08-01', classification: Classification.COMPLETED, count: 3 },
    { date: '2026-08-01', classification: Classification.PENDING, count: 2 },
    { date: '2026-08-03', classification: Classification.COMPLETED, count: 1 },
    { date: '2026-08-10', classification: null, count: 4 },
  ];

  it('aggregates by day with per-classification splits', () => {
    const trend = buildTrend(rows, 'daily');
    expect(trend).toHaveLength(3);
    expect(trend[0]).toEqual({
      bucket: '2026-08-01',
      total: 5,
      byClassification: { COMPLETED: 3, PENDING: 2 },
    });
    // null classification counts toward totals only
    expect(trend[2]).toEqual({ bucket: '2026-08-10', total: 4, byClassification: {} });
  });

  it('rolls up weekly (Monday buckets)', () => {
    const trend = buildTrend(rows, 'weekly');
    expect(trend.map((t) => [t.bucket, t.total])).toEqual([
      ['2026-07-27', 5], // Aug 1 (Sat) + Aug 3 falls... Aug 3 is Monday
      ['2026-08-03', 1],
      ['2026-08-10', 4],
    ]);
  });

  it('rolls up monthly', () => {
    const trend = buildTrend(rows, 'monthly');
    expect(trend).toHaveLength(1);
    expect(trend[0].total).toBe(10);
  });

  it('fills gaps with zero buckets across the requested range', () => {
    const trend = buildTrend(rows.slice(0, 1), 'daily', {
      from: new Date('2026-08-01T00:00:00Z'),
      to: new Date('2026-08-04T00:00:00Z'),
    });
    expect(trend.map((t) => t.bucket)).toEqual([
      '2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04',
    ]);
    expect(trend[1].total).toBe(0);
  });

  it('ignores unparseable dates', () => {
    expect(buildTrend([{ date: 'nope', classification: null, count: 9 }], 'daily')).toEqual([]);
  });
});
