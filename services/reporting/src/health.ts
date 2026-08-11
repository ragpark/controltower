import { OperationalHealth } from '@control-tower/shared-types';

export interface RunSummary {
  status: string;
  failedRows: number;
  startTime: Date | string;
}

export interface SourceSummary {
  sourceId: string;
  sourceName: string;
  enabled: boolean;
  schedule: string | null;
  lastRunAt: Date | string | null;
}

export interface DataQualityCounts {
  missingCustomer: number;
  missingOrderDate: number;
  unclassified: number;
  missingValue: number;
}

const STALE_HOURS = 24;

export function computeOperationalHealth(
  runs: RunSummary[],
  sources: SourceSummary[],
  quality: DataQualityCounts,
  now: Date = new Date(),
): OperationalHealth {
  const totalRuns = runs.length;
  const failedRuns = runs.filter((r) => r.status === 'FAILED').length;
  const failedRowsLast7d = runs
    .filter((r) => now.getTime() - new Date(r.startTime).getTime() <= 7 * 24 * 3600 * 1000)
    .reduce((sum, r) => sum + r.failedRows, 0);

  const staleSources = sources
    .filter((s) => s.enabled && s.schedule) // only scheduled sources can go stale
    .map((s) => {
      const last = s.lastRunAt ? new Date(s.lastRunAt) : null;
      const hours = last ? (now.getTime() - last.getTime()) / 3600000 : null;
      return {
        sourceId: s.sourceId,
        sourceName: s.sourceName,
        lastRunAt: last ? last.toISOString() : null,
        hoursSinceLastRun: hours === null ? null : Math.round(hours * 10) / 10,
      };
    })
    .filter((s) => s.hoursSinceLastRun === null || s.hoursSinceLastRun > STALE_HOURS);

  const dataQualityIssues = [
    { issue: 'Orders missing customer', count: quality.missingCustomer },
    { issue: 'Orders missing order date', count: quality.missingOrderDate },
    { issue: 'Orders missing value', count: quality.missingValue },
    { issue: 'Unclassified orders', count: quality.unclassified },
  ].filter((i) => i.count > 0);

  return {
    processingSuccessRate: totalRuns === 0 ? 1 : (totalRuns - failedRuns) / totalRuns,
    totalRuns,
    failedRuns,
    failedRowsLast7d,
    staleSources,
    dataQualityIssues,
  };
}
