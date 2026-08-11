import { parse } from 'csv-parse/sync';
import { ColumnMapping } from '@control-tower/shared-types';
import { DEFAULT_MAPPING, normalizeRow } from './normalizer';
import { ParseResult, RowError } from './types';

export interface CsvParseOptions {
  mapping?: ColumnMapping;
  delimiter?: string;
}

/** True when every cell in the row is empty — spreadsheet filler, not data. */
export function isBlankRow(row: Record<string, string>): boolean {
  return Object.values(row).every((value) => (value ?? '').trim() === '');
}

const normaliseHeader = (value: string) => value.trim().toLowerCase();

/**
 * The two fields that form the deduplication key must be mapped to real
 * columns; everything else is optional and simply left empty when absent.
 */
function missingRequiredHeaders(
  headers: string[],
  mapping: ColumnMapping,
): Array<{ field: string; header: string }> {
  const present = new Set(headers.map(normaliseHeader));
  return (
    [
      ['orderNumber', mapping.orderNumber],
      ['productCode', mapping.productCode],
    ] as const
  )
    .filter(([, header]) => !header || !present.has(normaliseHeader(header)))
    .map(([field, header]) => ({ field, header: header || '(not mapped)' }));
}

/**
 * Builds a single actionable message for a mapping/header mismatch. Without
 * this the same "missing required field" error repeats for every row and never
 * says the real cause: the source's column mapping doesn't fit this file.
 */
function mappingMismatchMessage(
  headers: string[],
  mapping: ColumnMapping,
  missing: Array<{ field: string; header: string }>,
): string {
  const expected = missing.map((m) => `"${m.header}" (for ${m.field})`).join(' and ');
  const parts = [
    `This source's column mapping does not fit the file: expected ${expected}, ` +
      `but the file's columns are: ${headers.join(', ')}.`,
    'Update the mapping in Settings → Data Sources so it matches these column names.',
  ];
  // The commonest cause is a source still carrying a stale mapping.
  if (mapping !== DEFAULT_MAPPING && missingRequiredHeaders(headers, DEFAULT_MAPPING).length === 0) {
    parts.push(
      'The built-in ActiveHub mapping matches this file — removing this source\'s ' +
        '"mapping" override will make the import work.',
    );
  }
  return parts.join(' ');
}

/**
 * Parse a CSV payload into normalized orders + row-level errors.
 * Never throws for bad rows — every problem is reported against its row number
 * (1-based, excluding the header) so import runs can log precisely.
 */
export function parseCsvOrders(
  content: Buffer | string,
  options: CsvParseOptions = {},
): ParseResult {
  const mapping = options.mapping ?? DEFAULT_MAPPING;

  let rows: Record<string, string>[];
  let headers: string[] = [];
  try {
    rows = parse(content, {
      columns: (header: string[]) => {
        headers = header;
        return header;
      },
      bom: true,
      delimiter: options.delimiter ?? ',',
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch (error) {
    return {
      orders: [],
      totalRows: 0,
      errors: [
        {
          row: 0,
          message: `CSV could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }

  // Fail fast on a mapping mismatch — one clear cause beats N identical rows.
  if (headers.length > 0) {
    const missing = missingRequiredHeaders(headers, mapping);
    if (missing.length > 0) {
      return {
        orders: [],
        totalRows: 0,
        errors: [{ row: 0, message: mappingMismatchMessage(headers, mapping, missing) }],
      };
    }
  }

  const orders: ParseResult['orders'] = [];
  const errors: RowError[] = [];
  let totalRows = 0;

  rows.forEach((row, index) => {
    // Spreadsheet exports pad the sheet with thousands of empty rows
    // (",,,,,,"). They are not data and must not be reported as failures.
    if (isBlankRow(row)) return;
    totalRows += 1;

    const { order, errors: rowErrors } = normalizeRow(row, mapping);
    if (order) {
      orders.push(order);
    } else {
      errors.push({ row: index + 1, message: rowErrors.join('; '), raw: row });
    }
  });

  return { orders, errors, totalRows };
}
