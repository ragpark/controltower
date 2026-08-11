import { parse } from 'csv-parse/sync';
import { ColumnMapping } from '@control-tower/shared-types';
import { DEFAULT_MAPPING, normalizeRow } from './normalizer';
import { ParseResult, RowError } from './types';

export interface CsvParseOptions {
  mapping?: ColumnMapping;
  delimiter?: string;
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
  try {
    rows = parse(content, {
      columns: true,
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

  const orders: ParseResult['orders'] = [];
  const errors: RowError[] = [];

  rows.forEach((row, index) => {
    const { order, errors: rowErrors } = normalizeRow(row, mapping);
    if (order) {
      orders.push(order);
    } else {
      errors.push({ row: index + 1, message: rowErrors.join('; '), raw: row });
    }
  });

  return { orders, errors, totalRows: rows.length };
}
