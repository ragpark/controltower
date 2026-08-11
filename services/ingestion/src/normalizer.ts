import { ColumnMapping } from '@control-tower/shared-types';
import { NormalizedOrder } from './types';

/**
 * Default mapping targets the ActiveHub orders export (BigCommerce orders
 * reconciled against Licence Manager). Any source can override this in
 * Settings → Data Sources.
 */
export const DEFAULT_MAPPING: ColumnMapping = {
  orderSource: 'order_source',
  orderNumber: 'order_id',
  orderState: 'Custom Status',
  orderStatus: 'order_status',
  orderDate: 'order_created_date_time',
  customerName: 'full_name',
  customerEmail: 'email',
  customerId: 'TEPAccountNumber',
  productCode: 'productcode',
  productName: 'productlongname',
  licenceOrderMatch: 'LicenceManagerOrderMatch',
  licenceIsbnMatch: 'LicenceManagerISBNMatch',
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

/**
 * Spreadsheet exports frequently turn long numeric identifiers (ISBNs, account
 * numbers) into scientific notation — "9.78141E+12". The original digits are
 * unrecoverable, and expanding the value would collapse every ISBN sharing a
 * prefix onto one code. Since productCode is half of the deduplication key,
 * such rows are rejected rather than silently merged.
 */
export function isScientificNotation(value: string): boolean {
  return /^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(value.trim());
}

export function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  // dd/mm/yyyy [hh:mm[:ss]] (UK export format) or ISO
  const uk = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(raw);
  if (uk) {
    const [, d, m, y, hh = '0', mm = '0', ss = '0'] = uk;
    const date = new Date(Date.UTC(+y, +m - 1, +d, +hh, +mm, +ss));
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

  if (productCode && isScientificNotation(productCode)) {
    errors.push(
      `Product code "${productCode}" was exported in scientific notation and has lost digits — ` +
        're-export with the column formatted as text',
    );
  }

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
      orderSource: pick(row, mapping.orderSource),
      customerId: pick(row, mapping.customerId),
      customerName: pick(row, mapping.customerName),
      customerEmail: pick(row, mapping.customerEmail),
      productCode: productCode as string,
      productName: pick(row, mapping.productName),
      orderStatus: pick(row, mapping.orderStatus),
      orderState: pick(row, mapping.orderState),
      licenceOrderMatch: pick(row, mapping.licenceOrderMatch),
      licenceIsbnMatch: pick(row, mapping.licenceIsbnMatch),
      quantity,
      value,
      orderDate,
    },
    errors: [],
  };
}
