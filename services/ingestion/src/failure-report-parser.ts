import {
  FAILURE_ROUTING,
  FailureCategory,
  FailureRouting,
} from '@control-tower/shared-types';

export interface ParsedFailure {
  orderNumber: string;
  contractNumber: string;
  orderDate: Date | null;
  rawMessage: string;
  category: FailureCategory;
  owner: string;
  suggestedAction: string;
}

export interface FailureParseResult {
  failures: ParsedFailure[];
  errors: Array<{ record: number; message: string }>;
  totalRecords: number;
}

/**
 * Matchers are evaluated in order and the first hit wins, so the most specific
 * pattern must come first — the generic HTTP-fault matcher would otherwise
 * swallow the 400s that have a precise cause. Adding a new error type is one
 * entry here; everything unmatched routes to Triage rather than being dropped.
 */
const CATEGORY_MATCHERS: Array<{ pattern: RegExp; category: FailureCategory }> = [
  {
    pattern: /customer_id\s+or\s+orgid\s+from\s+tep\s+is\s+null/i,
    category: FailureCategory.TEP_ACCOUNT_MISSING,
  },
  {
    pattern: /already\s+part\s+of\s+another\s+organi[sz]ation/i,
    category: FailureCategory.DUPLICATE_ORG_MEMBERSHIP,
  },
  { pattern: /invalid\s+characters/i, category: FailureCategory.INVALID_CUSTOMER_DATA },
  {
    pattern: /autorenew|create\s+license\s+error/i,
    category: FailureCategory.LICENCE_CONFIG_ERROR,
  },
  {
    pattern: /api\s+fault|middleware|http\/\d\.\d\s+(4\d\d|5\d\d)/i,
    category: FailureCategory.INTEGRATION_FAULT,
  },
];

export function categoriseFailure(message: string): FailureCategory {
  for (const { pattern, category } of CATEGORY_MATCHERS) {
    if (pattern.test(message)) return category;
  }
  return FailureCategory.UNCATEGORISED;
}

export function routeFailure(category: FailureCategory): FailureRouting {
  return FAILURE_ROUTING[category] ?? FAILURE_ROUTING[FailureCategory.UNCATEGORISED];
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * The report uses Oracle-style DD-MON-YYYY. Parsed explicitly rather than left
 * to Date, whose handling of that shape is engine-dependent.
 */
export function parseReportDate(raw: string): Date | null {
  const match = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(raw.trim());
  if (match) {
    const [, day, mon, year] = match;
    const month = MONTHS[mon.toLowerCase()];
    if (month === undefined) return null;
    const date = new Date(Date.UTC(+year, month, +day));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const fallback = new Date(raw.trim());
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

/** Only these labels start a new field; anything else is a wrapped continuation. */
const FIELD_LABELS: Record<string, keyof RawRecord> = {
  'order number': 'orderNumber',
  'order date': 'orderDate',
  'contract number': 'contractNumber',
  'error message': 'errorMessage',
};

interface RawRecord {
  orderNumber?: string;
  orderDate?: string;
  contractNumber?: string;
  errorMessage?: string;
}

/**
 * Parses the daily provisioning failure report.
 *
 * The report is fixed-width: long error messages wrap onto indented
 * continuation lines that carry no label, and those wraps fall on spaces. A
 * line is only treated as a new field when its label is one we recognise, so a
 * continuation containing a colon (`GPS-invokeCreateGPSApi:HTTP/1.1 400`)
 * cannot be mistaken for one.
 */
export function parseFailureReport(content: Buffer | string): FailureParseResult {
  const text = typeof content === 'string' ? content : content.toString('utf8');
  const failures: ParsedFailure[] = [];
  const errors: Array<{ record: number; message: string }> = [];

  let current: RawRecord | null = null;
  let lastField: keyof RawRecord | null = null;
  let totalRecords = 0;

  const flush = () => {
    if (!current) return;
    totalRecords += 1;
    const index = totalRecords;

    const orderNumber = (current.orderNumber ?? '').trim();
    if (!orderNumber) {
      errors.push({ record: index, message: 'Record has no Order Number — skipped' });
      current = null;
      return;
    }

    const rawMessage = collapseWhitespace(current.errorMessage ?? '');
    if (!rawMessage) {
      errors.push({
        record: index,
        message: `Order ${orderNumber} has no Error Message — skipped`,
      });
      current = null;
      return;
    }

    const category = categoriseFailure(rawMessage);
    const routing = routeFailure(category);
    failures.push({
      orderNumber,
      contractNumber: (current.contractNumber ?? '').trim(),
      orderDate: current.orderDate ? parseReportDate(current.orderDate) : null,
      rawMessage,
      category,
      owner: routing.owner,
      suggestedAction: routing.suggestedAction,
    });
    current = null;
  };

  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue;

    const labelled = /^\s*([A-Za-z][A-Za-z ]*?)\s*:\s?(.*)$/.exec(line);
    const label = labelled ? labelled[1].trim().toLowerCase() : null;
    const field = label ? FIELD_LABELS[label] : undefined;

    if (field) {
      // A second Order Number means the previous record is complete.
      if (field === 'orderNumber') flush();
      if (!current) current = {};
      current[field] = labelled![2].trim();
      lastField = field;
      continue;
    }

    // Unlabelled, non-blank line: a wrapped continuation of the last field.
    if (current && lastField) {
      current[lastField] = `${current[lastField] ?? ''} ${line.trim()}`;
    }
  }
  flush();

  return { failures, errors, totalRecords };
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
