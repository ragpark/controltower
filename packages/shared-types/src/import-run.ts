import { ImportRunStatus } from './enums';

export interface ImportLogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  row?: number;
  timestamp: string;
}

export interface ImportRunDto {
  id: string;
  sourceId: string;
  sourceName?: string;
  filename: string | null;
  totalRows: number;
  importedRows: number;
  successfulRows: number;
  failedRows: number;
  startTime: string;
  endTime: string | null;
  status: ImportRunStatus;
  log: ImportLogEntry[];
  triggeredBy: string | null;
}
