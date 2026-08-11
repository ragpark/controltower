import { parse } from 'csv-parse/sync';
import { ColumnMapping } from '@control-tower/shared-types';
import { DEFAULT_MAPPING, normaliseHeader, normalizeRow } from './normalizer';
import { ParseResult, RowError } from './types';

export interface CsvParseOptions {
  mapping?: ColumnMapping;
  delimiter?: string;
}

/** Delimiters seen in the wild from spreadsheet "Save as" variants. */
export const CANDIDATE_DELIMITERS = [',', '\t', ';', '|'];

const DELIMITER_LABELS: Record<string, string> = {
  ',': 'comma',
  '\t': 'tab',
  ';': 'semicolon',
  '|': 'pipe',
};

export const describeDelimiter = (delimiter: string) =>
  DELIMITER_LABELS[delimiter] ?? JSON.stringify(delimiter);

/** True when every cell in the row is empty — spreadsheet filler, not data. */
export function isBlankRow(row: Record<string, string>): boolean {
  return Object.values(row).every((value) => (value ?? '').trim() === '');
}

function asText(content: Buffer | string): string {
  return (typeof content === 'string' ? content : content.toString('utf8')).replace(
    /^\uFEFF/,
    '',
  );
}

function firstNonEmptyLine(content: Buffer | string): string {
  for (const line of asText(content).split(/\r?\n/)) {
    if (line.trim() !== '') return line;
  }
  return '';
}

/**
 * "Save as CSV" is not a guarantee: Excel's Text and Unicode Text options emit
 * tab-separated data, and some locales default to semicolons. Parsed with the
 * wrong delimiter the whole header collapses into one column, which then looks
 * like a broken column mapping. Prefer the configured delimiter, but when it
 * yields a single column and another candidate splits the header cleanly, use
 * that instead.
 */
export function detectDelimiter(content: Buffer | string, configured?: string): string {
  const preferred = configured || ',';
  const header = firstNonEmptyLine(content);
  if (!header) return preferred;

  const columnCount = (delimiter: string): number => {
    try {
      const [row] = parse(header, {
        delimiter,
        bom: true,
        trim: true,
        relax_column_count: true,
        relax_quotes: true,
      }) as string[][];
      return row?.length ?? 0;
    } catch {
      return 0;
    }
  };

  if (columnCount(preferred) > 1) return preferred;

  let best = preferred;
  let bestCount = 1;
  for (const candidate of CANDIDATE_DELIMITERS) {
    const count = columnCount(candidate);
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

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
 * says the real cause. Headers are JSON-quoted so tabs, zero-width characters
 * and stray padding are visible rather than silently rendering as whitespace.
 */
function mappingMismatchMessage(
  headers: string[],
  mapping: ColumnMapping,
  missing: Array<{ field: string; header: string }>,
  delimiter: string,
): string {
  const expected = missing.map((m) => `"${m.header}" (for ${m.field})`).join(' and ');
  const found = headers.map((h) => JSON.stringify(h)).join(', ');
  const parts = [
    `This source's column mapping does not fit the file: expected ${expected}, but the ` +
      `file's ${headers.length} column(s), read with a ${describeDelimiter(delimiter)} ` +
      `delimiter, are: ${found}.`,
  ];

  if (headers.length === 1) {
    parts.push(
      'The whole header row parsed as a single column, so the file is not ' +
        `${describeDelimiter(delimiter)}-separated. Set the correct "delimiter" in ` +
        'Settings → Data Sources, or re-export the file as comma-separated CSV.',
    );
  } else {
    parts.push('Update the mapping in Settings → Data Sources so it matches these column names.');
    if (
      mapping !== DEFAULT_MAPPING &&
      missingRequiredHeaders(headers, DEFAULT_MAPPING).length === 0
    ) {
      parts.push(
        'The built-in ActiveHub mapping matches this file — removing this source\'s ' +
          '"mapping" override will make the import work.',
      );
    }
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
  const delimiter = detectDelimiter(content, options.delimiter);

  let rows: Record<string, string>[];
  let headers: string[] = [];
  try {
    rows = parse(content, {
      columns: (header: string[]) => {
        headers = header;
        return header.map(normaliseHeader);
      },
      bom: true,
      delimiter,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch (error) {
    return {
      orders: [],
      totalRows: 0,
      delimiter,
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
        delimiter,
        errors: [
          { row: 0, message: mappingMismatchMessage(headers, mapping, missing, delimiter) },
        ],
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

  return { orders, errors, totalRows, delimiter };
}
