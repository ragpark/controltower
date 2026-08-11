import { ColumnMapping } from '@control-tower/shared-types';
import { NormalizedOrder } from './types';

export const DEFAULT_MAPPING: ColumnMapping = {
  sourceOrderId: 'Source Order Id',
  orderNumber: 'Order Number',
  customerId: 'Customer Id',
  customerName: 'Customer Name',
  productCode: 'Product Code',
  productName: 'Product Name',
  orderStatus: 'Order Status',
  orderState: 'Order State',
  quantity: 'Quantity',
  value: 'Value',
  orderDate: 'Order Date',
};

function pick(row: Record<string, string>, header?: string): string | null {
  if (!header) return null;
  // headers are matched case-insensitively and trimmed
  const key = Object.keys(row).find(
    (k) => k.trim().toLowerCase() === header.trim().toLowerCase(),
  );
  const value = key !== undefined ? row[key] : undefined;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseNumber(raw: string | null): number | null {
  if (raw === null) return null;
  const cleaned = raw.replace(/[£$€,\s]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  // dd/mm/yyyy (UK export format) or ISO
  const uk = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/.exec(raw);
  if (uk) {
    const [, d, m, y, hh = '0', mm = '0'] = uk;
    const date = new Date(Date.UTC(+y, +m - 1, +d, +hh, +mm));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export interface NormalizeOutcome {
  order: NormalizedOrder | null;
  errors: string[];
}

/** Map a raw CSV row into the canonical order shape, validating required fields. */
export function normalizeRow(
  row: Record<string, string>,
  mapping: ColumnMapping = DEFAULT_MAPPING,
): NormalizeOutcome {
  const errors: string[] = [];

  const orderNumber = pick(row, mapping.orderNumber);
  const productCode = pick(row, mapping.productCode);
  if (!orderNumber) errors.push(`Missing required field "${mapping.orderNumber}"`);
  if (!productCode) errors.push(`Missing required field "${mapping.productCode}"`);

  const rawQuantity = pick(row, mapping.quantity);
  const quantity = parseNumber(rawQuantity);
  if (rawQuantity !== null && quantity === null) {
    errors.push(`Invalid quantity "${rawQuantity}"`);
  }

  const rawValue = pick(row, mapping.value);
  const value = parseNumber(rawValue);
  if (rawValue !== null && value === null) {
    errors.push(`Invalid value "${rawValue}"`);
  }

  const rawDate = pick(row, mapping.orderDate);
  const orderDate = parseDate(rawDate);
  if (rawDate !== null && orderDate === null) {
    errors.push(`Invalid order date "${rawDate}"`);
  }

  if (errors.length > 0) return { order: null, errors };

  return {
    order: {
      sourceOrderId: pick(row, mapping.sourceOrderId),
      orderNumber: orderNumber as string,
      customerId: pick(row, mapping.customerId),
      customerName: pick(row, mapping.customerName),
      productCode: productCode as string,
      productName: pick(row, mapping.productName),
      orderStatus: pick(row, mapping.orderStatus),
      orderState: pick(row, mapping.orderState),
      quantity,
      value,
      orderDate,
    },
    errors: [],
  };
}
