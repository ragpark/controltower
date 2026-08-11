import { parseCsvOrders } from '../csv-parser';

const CSV = `Order Number,Product Code,Customer Name,Order Status,Quantity,Value,Order Date
ORD-1001,PRD-A,Acme Ltd,Placed,2,150.00,01/07/2026
ORD-1002,PRD-B,Globex,Shipped,1,"1,200.50",2026-07-15
,PRD-C,MissingOrderNo,Placed,1,10,2026-07-01
ORD-1004,PRD-D,BadQty,Placed,two,10,2026-07-01
`;

describe('parseCsvOrders', () => {
  it('parses valid rows into normalized orders', () => {
    const result = parseCsvOrders(CSV);
    expect(result.totalRows).toBe(4);
    expect(result.orders).toHaveLength(2);
    const [first, second] = result.orders;
    expect(first).toMatchObject({
      orderNumber: 'ORD-1001',
      productCode: 'PRD-A',
      customerName: 'Acme Ltd',
      orderStatus: 'Placed',
      quantity: 2,
      value: 150,
    });
    // UK date dd/mm/yyyy
    expect(first.orderDate?.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    // quoted thousands separator
    expect(second.value).toBe(1200.5);
  });

  it('reports row-level errors with 1-based row numbers', () => {
    const result = parseCsvOrders(CSV);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toMatchObject({ row: 3 });
    expect(result.errors[0].message).toContain('Order Number');
    expect(result.errors[1]).toMatchObject({ row: 4 });
    expect(result.errors[1].message).toContain('Invalid quantity');
  });

  it('supports custom column mappings (case-insensitive headers)', () => {
    const csv = 'order_no;sku\nA-1;S-9\n';
    const result = parseCsvOrders(csv, {
      delimiter: ';',
      mapping: { orderNumber: 'ORDER_NO', productCode: 'sku' },
    });
    expect(result.orders).toEqual([
      expect.objectContaining({ orderNumber: 'A-1', productCode: 'S-9' }),
    ]);
  });

  it('handles a BOM and empty input', () => {
    expect(parseCsvOrders('﻿Order Number,Product Code\nX,Y\n').orders).toHaveLength(1);
    expect(parseCsvOrders('').totalRows).toBe(0);
  });

  it('returns a file-level error for unparseable CSV instead of throwing', () => {
    const result = parseCsvOrders('a,b\n"unclosed');
    expect(result.orders).toHaveLength(0);
    expect(result.errors[0].row).toBe(0);
    expect(result.errors[0].message).toContain('CSV could not be parsed');
  });

  it('rejects invalid dates and currency symbols are stripped from values', () => {
    const csv =
      'Order Number,Product Code,Value,Order Date\nA,B,£99.99,2026-01-05\nC,D,10,notadate\n';
    const result = parseCsvOrders(csv);
    expect(result.orders[0].value).toBe(99.99);
    expect(result.errors[0].message).toContain('Invalid order date');
  });
});
