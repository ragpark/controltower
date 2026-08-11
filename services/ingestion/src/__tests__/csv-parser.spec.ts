import { describeDelimiter, detectDelimiter, isBlankRow, parseCsvOrders } from '../csv-parser';

const HEADER =
  'order_source,order_id,Custom Status,order_status,order_created_date_time,full_name,email,TEPAccountNumber,productcode,productlongname,LicenceManagerOrderMatch,LicenceManagerISBNMatch';

const CSV = [
  HEADER,
  'Big Commerce,136,Order Pending,Incomplete,11/02/2026 13:04,Alexa Foley,alexa@yopmail.com,,9781410000001,KS4 Maths,Not Match,Not Match',
  'Big Commerce,137,Order Complete,Complete,10/08/2026 09:12,Marcus Bell,m.bell@ng.org,TEP0010423,9781410000018,KS3 Science,Match,Match',
  'Big Commerce,,Order Pending,Incomplete,10/08/2026 09:12,No Order Id,x@y.com,,9781410000025,Missing order id,Match,Match',
  'Big Commerce,156,Order Pending,Incomplete,11/02/2026 13:04,Alexa Foley,alexa@yopmail.com,,9.78141E+12,Mangled ISBN,Not Match,Not Match',
  ',,,,,,,,,,,',
  ',,,,,,,,,,,',
].join('\n');

describe('parseCsvOrders — ActiveHub export', () => {
  it('maps ActiveHub headers onto the canonical order shape', () => {
    const result = parseCsvOrders(CSV);
    const [first, second] = result.orders;

    expect(first).toMatchObject({
      orderNumber: '136',
      orderSource: 'Big Commerce',
      orderState: 'Order Pending',
      orderStatus: 'Incomplete',
      customerName: 'Alexa Foley',
      customerEmail: 'alexa@yopmail.com',
      customerId: null,
      productCode: '9781410000001',
      productName: 'KS4 Maths',
      licenceOrderMatch: 'Not Match',
      licenceIsbnMatch: 'Not Match',
    });
    // dd/mm/yyyy hh:mm
    expect(first.orderDate?.toISOString()).toBe('2026-02-11T13:04:00.000Z');
    expect(second.customerId).toBe('TEP0010423');
  });

  it('skips spreadsheet filler rows instead of reporting them as failures', () => {
    const result = parseCsvOrders(CSV);
    // 4 populated rows; the two all-empty rows are not data and never counted
    expect(result.totalRows).toBe(4);
    expect(result.orders).toHaveLength(2);
    // exactly the two genuinely bad rows — no filler-row noise
    expect(result.errors).toHaveLength(2);
  });

  it('a sheet padded with thousands of empty rows imports cleanly', () => {
    const padded = [
      HEADER,
      'Big Commerce,136,Order Pending,Incomplete,11/02/2026 13:04,A B,a@b.com,,9781410000001,P,Match,Match',
      ...Array.from({ length: 2000 }, () => ',,,,,,,,,,,'),
    ].join('\r\n');
    const result = parseCsvOrders(padded);
    expect(result.totalRows).toBe(1);
    expect(result.orders).toHaveLength(1);
    expect(result.errors).toEqual([]);
  });

  it('rejects product codes mangled into scientific notation', () => {
    const result = parseCsvOrders(CSV);
    const mangled = result.errors.find((e) => e.message.includes('scientific notation'));
    expect(mangled).toBeDefined();
    expect(mangled!.message).toContain('9.78141E+12');
    expect(mangled!.message).toContain('formatted as text');
    // never enters the dataset — it would collide with every ISBN sharing the prefix
    expect(result.orders.map((o) => o.productCode)).not.toContain('9781410000000');
  });

  it('reports missing required identifiers with the mapped header name', () => {
    const result = parseCsvOrders(CSV);
    const missing = result.errors.find((e) => e.message.includes('Missing required field'));
    expect(missing!.message).toContain('order_id');
  });

  it('handles a BOM and CRLF line endings from Excel exports', () => {
    const csv = `﻿${HEADER}\r\nBig Commerce,200,Order Complete,Complete,01/08/2026 10:00,A B,a@b.com,,9781410000117,Product,Match,Match\r\n`;
    const result = parseCsvOrders(csv);
    expect(result.orders).toHaveLength(1);
    expect(result.orders[0].licenceIsbnMatch).toBe('Match');
  });

  it('supports custom column mappings for non-ActiveHub sources', () => {
    const csv = 'order_no;sku\nA-1;S-9\n';
    const result = parseCsvOrders(csv, {
      delimiter: ';',
      mapping: { orderNumber: 'ORDER_NO', productCode: 'sku' },
    });
    expect(result.orders).toEqual([
      expect.objectContaining({ orderNumber: 'A-1', productCode: 'S-9' }),
    ]);
  });

  it('returns a file-level error for unparseable CSV instead of throwing', () => {
    const result = parseCsvOrders('a,b\n"unclosed');
    expect(result.orders).toHaveLength(0);
    expect(result.errors[0].row).toBe(0);
    expect(result.errors[0].message).toContain('CSV could not be parsed');
  });

  it('empty input yields no rows', () => {
    expect(parseCsvOrders('').totalRows).toBe(0);
  });

  it('validates optional quantity, value and date columns when mapped', () => {
    const csv =
      'order_id,productcode,Quantity,Value,order_created_date_time\n' +
      'A,B,2,£99.99,2026-01-05\n' +
      'C,D,two,10,2026-01-05\n' +
      'E,F,1,10,notadate\n';
    const mapping = {
      orderNumber: 'order_id',
      productCode: 'productcode',
      quantity: 'Quantity',
      value: 'Value',
      orderDate: 'order_created_date_time',
    };
    const result = parseCsvOrders(csv, { mapping });
    expect(result.orders[0]).toMatchObject({ quantity: 2, value: 99.99 });
    expect(result.errors[0].message).toContain('Invalid quantity');
    expect(result.errors[1].message).toContain('Invalid order date');
  });
});

describe('column mapping mismatch', () => {
  const LEGACY_MAPPING = { orderNumber: 'Order Number', productCode: 'Product Code' };

  it('reports one actionable cause instead of an error per row', () => {
    const result = parseCsvOrders(CSV, { mapping: LEGACY_MAPPING });
    expect(result.errors).toHaveLength(1);
    expect(result.orders).toHaveLength(0);
    const [error] = result.errors;
    expect(error.row).toBe(0);
    expect(error.message).toContain('column mapping does not fit the file');
    // names what it wanted and what the file actually has
    expect(error.message).toContain('"Order Number"');
    expect(error.message).toContain('"Product Code"');
    expect(error.message).toContain('order_id');
    expect(error.message).toContain('productcode');
    expect(error.message).toContain('Settings → Data Sources');
  });

  it('points out when the built-in ActiveHub mapping would work', () => {
    const [error] = parseCsvOrders(CSV, { mapping: LEGACY_MAPPING }).errors;
    expect(error.message).toContain('built-in ActiveHub mapping matches this file');
  });

  it('omits that hint when the default mapping would not help either', () => {
    const csv = 'colA,colB\n1,2\n';
    const [error] = parseCsvOrders(csv, { mapping: LEGACY_MAPPING }).errors;
    expect(error.message).not.toContain('built-in ActiveHub mapping matches');
    // headers are JSON-quoted so tabs and zero-width characters are visible
    expect(error.message).toContain('"colA", "colB"');
  });

  it('flags a mapping that omits a required field entirely', () => {
    const [error] = parseCsvOrders(CSV, {
      mapping: { orderNumber: 'order_id' } as never,
    }).errors;
    expect(error.message).toContain('(not mapped)');
    expect(error.message).toContain('productCode');
  });

  it('accepts a correct mapping and imports normally', () => {
    expect(parseCsvOrders(CSV).errors.every((e) => e.row > 0)).toBe(true);
  });
});

describe('delimiter detection', () => {
  const COLUMNS = [
    'order_source', 'order_id', 'Custom Status', 'order_status',
    'order_created_date_time', 'full_name', 'email', 'TEPAccountNumber',
    'productcode', 'productlongname', 'LicenceManagerOrderMatch', 'LicenceManagerISBNMatch',
  ];
  const VALUES = [
    'Big Commerce', '136', 'Order Pending', 'Incomplete', '11/02/2026 13:04',
    'Alexa Foley', 'a@b.com', '', '9781410000001', 'KS4 Maths', 'Match', 'Match',
  ];
  const build = (d: string) => `${COLUMNS.join(d)}\n${VALUES.join(d)}\n`;

  // Excel's "Text"/"Unicode Text" save options emit tabs while keeping a .csv
  // name; parsed as comma-separated the whole header becomes one column.
  it.each([
    ['\t', 'tab'],
    [';', 'semicolon'],
    ['|', 'pipe'],
  ])('imports a %s-separated file even though the source says comma', (delimiter) => {
    const result = parseCsvOrders(build(delimiter), { delimiter: ',' });
    expect(result.delimiter).toBe(delimiter);
    expect(result.errors).toEqual([]);
    expect(result.orders).toHaveLength(1);
    expect(result.orders[0]).toMatchObject({
      orderNumber: '136',
      productCode: '9781410000001',
      licenceIsbnMatch: 'Match',
    });
  });

  it('keeps the configured delimiter when it already splits the header', () => {
    const result = parseCsvOrders(build(','), { delimiter: ',' });
    expect(result.delimiter).toBe(',');
    expect(result.orders).toHaveLength(1);
  });

  it('respects an explicitly configured non-comma delimiter', () => {
    expect(detectDelimiter(build(';'), ';')).toBe(';');
  });

  it('falls back to the configured delimiter for a single-column file', () => {
    expect(detectDelimiter('order_id\nA-1\n', ',')).toBe(',');
  });

  it('handles empty content without throwing', () => {
    expect(detectDelimiter('', ',')).toBe(',');
  });

  it('names delimiters in human terms for the import log', () => {
    expect(describeDelimiter('\t')).toBe('tab');
    expect(describeDelimiter(',')).toBe('comma');
    expect(describeDelimiter('^')).toBe('"^"');
  });
});

describe('invisible characters in headers', () => {
  it('matches headers containing zero-width spaces, BOMs and non-breaking spaces', () => {
    const header =
      '\uFEFForder_source,\u200Border_id,\u00A0productcode\u200B';
    const result = parseCsvOrders(`${header}\nBig Commerce,136,9781410000001\n`, {
      mapping: { orderNumber: 'order_id', productCode: 'productcode' },
    });
    expect(result.errors).toEqual([]);
    expect(result.orders[0]).toMatchObject({
      orderNumber: '136',
      productCode: '9781410000001',
    });
  });
});

describe('isBlankRow', () => {
  it('detects all-empty and whitespace-only rows', () => {
    expect(isBlankRow({ a: '', b: '   ' })).toBe(true);
    expect(isBlankRow({ a: '', b: 'x' })).toBe(false);
  });
});
