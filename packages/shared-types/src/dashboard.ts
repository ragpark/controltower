import { Classification } from './enums';

export interface DashboardSummary {
  total: number;
  byClassification: Record<Classification, number>;
  unclassified: number;
}

export interface BreakdownItem {
  key: string;
  label: string;
  count: number;
}

export type TrendGranularity = 'daily' | 'weekly' | 'monthly';

export interface TrendBucket {
  bucket: string; // ISO date of bucket start
  total: number;
  byClassification: Partial<Record<Classification, number>>;
}

export interface OperationalHealth {
  processingSuccessRate: number; // 0..1 over the window
  totalRuns: number;
  failedRuns: number;
  failedRowsLast7d: number;
  staleSources: Array<{
    sourceId: string;
    sourceName: string;
    lastRunAt: string | null;
    hoursSinceLastRun: number | null;
  }>;
  dataQualityIssues: Array<{ issue: string; count: number }>;
}
