import { isBlankRow, parseCsvOrders } from '../csv-parser';

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

describe('isBlankRow', () => {
  it('detects all-empty and whitespace-only rows', () => {
    expect(isBlankRow({ a: '', b: '   ' })).toBe(true);
    expect(isBlankRow({ a: '', b: 'x' })).toBe(false);
  });
});
