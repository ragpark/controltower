import { DEFAULT_MAPPING, isScientificNotation, normalizeRow, parseDate } from '../normalizer';

describe('isScientificNotation', () => {
  it.each(['9.78141E+12', '9.78141e+12', '1E5', '-2.5E-3'])('flags %s', (value) => {
    expect(isScientificNotation(value)).toBe(true);
  });

  it.each(['9781410000001', 'ABC-123', 'E12', '978-1-4104-0000-1', ''])(
    'accepts %s as a real code',
    (value) => {
      expect(isScientificNotation(value)).toBe(false);
    },
  );
});

describe('parseDate', () => {
  it('parses dd/mm/yyyy hh:mm (ActiveHub) as UTC', () => {
    expect(parseDate('11/02/2026 13:04')?.toISOString()).toBe('2026-02-11T13:04:00.000Z');
  });

  it('parses dd/mm/yyyy with seconds and without a time', () => {
    expect(parseDate('11/02/2026 13:04:30')?.toISOString()).toBe('2026-02-11T13:04:30.000Z');
    expect(parseDate('11/02/2026')?.toISOString()).toBe('2026-02-11T00:00:00.000Z');
  });

  it('parses ISO dates and rejects junk', () => {
    expect(parseDate('2026-08-11T09:00:00Z')?.toISOString()).toBe('2026-08-11T09:00:00.000Z');
    expect(parseDate('notadate')).toBeNull();
    expect(parseDate(null)).toBeNull();
  });
});

describe('normalizeRow', () => {
  const row = {
    order_source: 'Big Commerce',
    order_id: '136',
    'Custom Status': 'Order Pending',
    order_status: 'Incomplete',
    order_created_date_time: '11/02/2026 13:04',
    full_name: 'Alexa Foley',
    email: 'alexa@yopmail.com',
    TEPAccountNumber: '',
    productcode: '9781410000001',
    productlongname: 'KS4 Maths',
    LicenceManagerOrderMatch: 'Not Match',
    LicenceManagerISBNMatch: 'Not Match',
  };

  it('maps every ActiveHub column with the default mapping', () => {
    const { order, errors } = normalizeRow(row);
    expect(errors).toEqual([]);
    expect(order).toMatchObject({
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
      quantity: null,
      value: null,
    });
  });

  it('matches headers case-insensitively and trims surrounding spaces', () => {
    const { order } = normalizeRow({
      ' ORDER_ID ': '999',
      ProductCode: 'ignored',
      productcode: '9781410000001',
    });
    expect(order?.orderNumber).toBe('999');
  });

  it('rejects a scientific-notation product code with actionable guidance', () => {
    const { order, errors } = normalizeRow({ ...row, productcode: '9.78141E+12' });
    expect(order).toBeNull();
    expect(errors[0]).toContain('lost digits');
  });

  it('reports both missing identifiers at once', () => {
    const { errors } = normalizeRow({ ...row, order_id: '', productcode: '' });
    expect(errors).toHaveLength(2);
  });

  it('default mapping targets the ActiveHub headers', () => {
    expect(DEFAULT_MAPPING.orderNumber).toBe('order_id');
    expect(DEFAULT_MAPPING.productCode).toBe('productcode');
    expect(DEFAULT_MAPPING.licenceOrderMatch).toBe('LicenceManagerOrderMatch');
  });
});
