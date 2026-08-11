import { SourceConfig } from '@control-tower/shared-types';

/** A file retrieved from a source, ready for parsing. */
export interface FetchedFile {
  filename: string;
  content: Buffer | string;
}

export interface RowError {
  row: number;
  message: string;
  raw?: Record<string, string>;
}

/** Canonical order record produced by parsing + mapping + validation. */
export interface NormalizedOrder {
  sourceOrderId: string | null;
  orderNumber: string;
  orderSource: string | null;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  productCode: string;
  productName: string | null;
  orderStatus: string | null;
  orderState: string | null;
  licenceOrderMatch: string | null;
  licenceIsbnMatch: string | null;
  quantity: number | null;
  value: number | null;
  orderDate: Date | null;
}

export interface ParseResult {
  orders: NormalizedOrder[];
  errors: RowError[];
  totalRows: number;
  /** Delimiter actually used — may differ from the configured one if detected. */
  delimiter: string;
}

export type { SourceConfig };
