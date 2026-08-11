import { computeOperationalHealth } from '../health';

const NOW = new Date('2026-08-11T12:00:00Z');

describe('computeOperationalHealth', () => {
  const quality = { missingCustomer: 2, missingOrderDate: 0, unclassified: 1, missingValue: 0 };

  it('computes success rate and failure counts', () => {
    const runs = [
      { status: 'COMPLETED', failedRows: 0, startTime: '2026-08-10T00:00:00Z' },
      { status: 'FAILED', failedRows: 5, startTime: '2026-08-09T00:00:00Z' },
      { status: 'COMPLETED_WITH_ERRORS', failedRows: 2, startTime: '2026-08-01T00:00:00Z' },
    ];
    const health = computeOperationalHealth(runs, [], quality, NOW);
    expect(health.totalRuns).toBe(3);
    expect(health.failedRuns).toBe(1);
    expect(health.processingSuccessRate).toBeCloseTo(2 / 3);
    // 7-day window excludes the Aug 1 run's failed rows
    expect(health.failedRowsLast7d).toBe(5);
  });

  it('success rate is 1 with no runs', () => {
    expect(computeOperationalHealth([], [], quality, NOW).processingSuccessRate).toBe(1);
  });

  it('flags scheduled sources not run in 24h (or never run) as stale', () => {
    const sources = [
      { sourceId: 's1', sourceName: 'Fresh', enabled: true, schedule: '0 * * * *', lastRunAt: '2026-08-11T09:00:00Z' },
      { sourceId: 's2', sourceName: 'Stale', enabled: true, schedule: '0 * * * *', lastRunAt: '2026-08-09T00:00:00Z' },
      { sourceId: 's3', sourceName: 'NeverRan', enabled: true, schedule: '0 * * * *', lastRunAt: null },
      { sourceId: 's4', sourceName: 'ManualOnly', enabled: true, schedule: null, lastRunAt: null },
      { sourceId: 's5', sourceName: 'Disabled', enabled: false, schedule: '0 * * * *', lastRunAt: null },
    ];
    const health = computeOperationalHealth([], sources, quality, NOW);
    expect(health.staleSources.map((s) => s.sourceName).sort()).toEqual(['NeverRan', 'Stale']);
    expect(health.staleSources.find((s) => s.sourceName === 'Stale')?.hoursSinceLastRun).toBe(60);
  });

  it('only reports data-quality issues with non-zero counts', () => {
    const health = computeOperationalHealth([], [], quality, NOW);
    expect(health.dataQualityIssues).toEqual([
      { issue: 'Orders missing customer', count: 2 },
      { issue: 'Unclassified orders', count: 1 },
    ]);
  });
});
