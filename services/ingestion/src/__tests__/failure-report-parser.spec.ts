import { FailureCategory } from '@control-tower/shared-types';
import {
  categoriseFailure,
  parseFailureReport,
  parseReportDate,
} from '../failure-report-parser';

// Verbatim shape of the daily email, including the fixed-width wrapping and
// trailing padding that the real report carries.
const REPORT = [
  '  Order Number   :        13925034                                            ',
  '  Order Date     : 06-AUG-2026                                                ',
  '  Contract Number: 8030959                                                    ',
  '  Error Message  : Status: CUSTOMER_ID or OrgId from TEP is NULL(GPSFlow      ',
  '                   ValidationError)                                           ',
  '                                                                              ',
  '  Order Number   :        13925051                                            ',
  '  Order Date     : 06-AUG-2026                                                ',
  '  Contract Number: 8030971                                                    ',
  '  Error Message  : Status:GPS-invokeCreateGPSApi:HTTP/1.1 400 Bad Request.    ',
  '                   lastName contains invalid characters                       ',
  '                                                                              ',
  '  Order Number   :        13925030                                            ',
  '  Order Date     : 06-AUG-2026                                                ',
  '  Contract Number: 8030957                                                    ',
  '  Error Message  : Status:GPS-invokeRegisterGPS:HTTP/1.1 400 Bad Request. User',
  '                   already part of another organization in Active Hub         ',
].join('\n');

describe('parseFailureReport', () => {
  const result = parseFailureReport(REPORT);

  it('reads every record in the report', () => {
    expect(result.totalRecords).toBe(3);
    expect(result.failures).toHaveLength(3);
    expect(result.errors).toEqual([]);
  });

  it('extracts the fields, trimming the fixed-width padding', () => {
    expect(result.failures[0]).toMatchObject({
      orderNumber: '13925034',
      contractNumber: '8030959',
      rawMessage: 'Status: CUSTOMER_ID or OrgId from TEP is NULL(GPSFlow ValidationError)',
    });
    expect(result.failures[0].orderDate?.toISOString()).toBe('2026-08-06T00:00:00.000Z');
  });

  it('rejoins error messages wrapped across continuation lines', () => {
    expect(result.failures[1].rawMessage).toBe(
      'Status:GPS-invokeCreateGPSApi:HTTP/1.1 400 Bad Request. lastName contains invalid characters',
    );
    // the wrap fell mid-sentence after "User"
    expect(result.failures[2].rawMessage).toBe(
      'Status:GPS-invokeRegisterGPS:HTTP/1.1 400 Bad Request. User already part of another organization in Active Hub',
    );
  });

  it('does not mistake a colon inside a continuation for a new field', () => {
    const wrapped = [
      '  Order Number   : 999',
      '  Error Message  : Create License Error : Status:HTTP/1.1 400. autoRenew:',
      '                   Autorenew must be YES or NO.',
    ].join('\n');
    const parsed = parseFailureReport(wrapped);
    expect(parsed.failures).toHaveLength(1);
    expect(parsed.failures[0].rawMessage).toBe(
      'Create License Error : Status:HTTP/1.1 400. autoRenew: Autorenew must be YES or NO.',
    );
  });

  it('separates records even without blank lines between them', () => {
    const packed = [
      '  Order Number   : 1',
      '  Error Message  : Status: CUSTOMER_ID or OrgId from TEP is NULL',
      '  Order Number   : 2',
      '  Error Message  : Status: CUSTOMER_ID or OrgId from TEP is NULL',
    ].join('\n');
    expect(parseFailureReport(packed).failures.map((f) => f.orderNumber)).toEqual(['1', '2']);
  });

  it('reports incomplete records instead of dropping them silently', () => {
    const broken = [
      '  Order Number   : 555',
      '  Contract Number: 900',
      '',
      '  Order Number   : 556',
      '  Error Message  : Status: CUSTOMER_ID or OrgId from TEP is NULL',
    ].join('\n');
    const parsed = parseFailureReport(broken);
    expect(parsed.failures).toHaveLength(1);
    expect(parsed.errors[0].message).toContain('555');
    expect(parsed.errors[0].message).toContain('no Error Message');
  });

  it('handles CRLF line endings and an empty report', () => {
    expect(parseFailureReport(REPORT.replace(/\n/g, '\r\n')).failures).toHaveLength(3);
    expect(parseFailureReport('').failures).toEqual([]);
  });

  it('accepts a Buffer', () => {
    expect(parseFailureReport(Buffer.from(REPORT)).failures).toHaveLength(3);
  });
});

describe('categoriseFailure', () => {
  it.each([
    ['Status: CUSTOMER_ID or OrgId from TEP is NULL(GPSFlow ValidationError)', FailureCategory.TEP_ACCOUNT_MISSING],
    ['Status:HTTP/1.1 400 Bad Request. lastName contains invalid characters', FailureCategory.INVALID_CUSTOMER_DATA],
    ['User already part of another organization in Active Hub', FailureCategory.DUPLICATE_ORG_MEMBERSHIP],
    ['Create License Error : Status:HTTP/1.1 400. autoRenew: Autorenew must be YES or NO.', FailureCategory.LICENCE_CONFIG_ERROR],
    ['Status:HTTP/1.1 404. GET License: AES sent API fault to middleware', FailureCategory.INTEGRATION_FAULT],
  ])('categorises %s', (message, expected) => {
    expect(categoriseFailure(message)).toBe(expected);
  });

  it('routes anything unrecognised to triage rather than dropping it', () => {
    expect(categoriseFailure('Something entirely new went wrong')).toBe(
      FailureCategory.UNCATEGORISED,
    );
  });

  // The generic HTTP matcher must not swallow errors with a precise cause.
  it('prefers the specific cause over the generic HTTP fault', () => {
    expect(
      categoriseFailure('Status:GPS:HTTP/1.1 400 Bad Request. lastName contains invalid characters'),
    ).toBe(FailureCategory.INVALID_CUSTOMER_DATA);
  });

  it('assigns an owner and action to every category', () => {
    const { failures } = parseFailureReport(REPORT);
    for (const failure of failures) {
      expect(failure.owner).toBeTruthy();
      expect(failure.suggestedAction).toBeTruthy();
    }
    expect(failures[0].owner).toBe('Customer Data');
    expect(failures[2].owner).toBe('ActiveHub Support');
  });
});

describe('parseReportDate', () => {
  it('parses Oracle-style DD-MON-YYYY as UTC', () => {
    expect(parseReportDate('06-AUG-2026')?.toISOString()).toBe('2026-08-06T00:00:00.000Z');
    expect(parseReportDate('31-dec-2025')?.toISOString()).toBe('2025-12-31T00:00:00.000Z');
  });

  it('falls back to ISO and rejects junk', () => {
    expect(parseReportDate('2026-08-06')?.toISOString()).toBe('2026-08-06T00:00:00.000Z');
    expect(parseReportDate('06-XXX-2026')).toBeNull();
    expect(parseReportDate('nonsense')).toBeNull();
  });
});
