import { SourceStatus, SourceType } from './enums';

/** Column mapping: canonical order field -> source column header. */
export interface ColumnMapping {
  sourceOrderId?: string;
  orderNumber: string;
  /** Sales channel the order originated from, e.g. "Big Commerce". */
  orderSource?: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  productCode: string;
  productName?: string;
  orderStatus?: string;
  orderState?: string;
  quantity?: string;
  value?: string;
  orderDate?: string;
  /** Licence Manager reconciliation: does the order match a licence record? */
  licenceOrderMatch?: string;
  /** Licence Manager reconciliation: does the ISBN match the licensed product? */
  licenceIsbnMatch?: string;
}

export interface SourceConfig {
  /** connector-specific settings */
  connector?: Record<string, unknown>;
  /** CSV column mapping */
  mapping?: ColumnMapping;
  /** CSV delimiter, default ',' */
  delimiter?: string;
}

export interface SourceDto {
  id: string;
  name: string;
  type: SourceType;
  status: SourceStatus;
  enabled: boolean;
  schedule: string | null;
  configJson: SourceConfig;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastRun?: {
    id: string;
    status: string;
    startTime: string;
    successfulRows: number;
    failedRows: number;
  } | null;
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
}

export interface SourceTypeInfo {
  type: SourceType;
  label: string;
  supportsSchedule: boolean;
  supportsUpload: boolean;
  configHints: Record<string, string>;
}
