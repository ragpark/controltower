import { changedFields, dedupeWithinBatch, dedupKey } from '../dedup';
import { NormalizedOrder } from '../types';

function order(partial: Partial<NormalizedOrder>): NormalizedOrder {
  return {
    sourceOrderId: null,
    orderNumber: 'ORD-1',
    customerId: null,
    customerName: null,
    productCode: 'P-1',
    productName: null,
    orderStatus: null,
    orderState: null,
    quantity: null,
    value: null,
    orderDate: null,
    ...partial,
  };
}

describe('dedupKey', () => {
  it('is case-insensitive and trims whitespace', () => {
    expect(dedupKey(order({ orderNumber: ' ORD-1 ', productCode: 'p-1' }))).toBe(
      dedupKey(order({ orderNumber: 'ord-1', productCode: ' P-1' })),
    );
  });

  it('differs when either key part differs', () => {
    expect(dedupKey(order({ productCode: 'P-2' }))).not.toBe(dedupKey(order({})));
    expect(dedupKey(order({ orderNumber: 'ORD-2' }))).not.toBe(dedupKey(order({})));
  });
});

describe('dedupeWithinBatch', () => {
  it('last occurrence wins and duplicates are reported', () => {
    const result = dedupeWithinBatch([
      order({ orderStatus: 'Placed' }),
      order({ orderNumber: 'ORD-2' }),
      order({ orderStatus: 'Shipped' }), // same key as first
    ]);
    expect(result.unique).toHaveLength(2);
    expect(result.unique.find((o) => o.orderNumber === 'ORD-1')?.orderStatus).toBe('Shipped');
    expect(result.duplicates).toEqual([{ key: 'ord-1::p-1', occurrences: 2 }]);
  });

  it('no duplicates → empty report', () => {
    expect(dedupeWithinBatch([order({}), order({ orderNumber: 'X' })]).duplicates).toEqual([]);
  });
});

describe('changedFields', () => {
  it('detects real changes only', () => {
    const existing = {
      customerName: 'Acme',
      orderStatus: 'Placed',
      quantity: 2,
      value: '150',
      orderDate: new Date('2026-07-01T00:00:00Z'),
    };
    const incoming = order({
      customerName: 'Acme',
      orderStatus: 'Shipped',
      quantity: 2,
      value: 150,
      orderDate: new Date('2026-07-01T00:00:00Z'),
    });
    expect(changedFields(existing, incoming)).toEqual(['orderStatus']);
  });

  it('treats null, undefined and empty string as equivalent', () => {
    expect(changedFields({ customerName: '' }, order({ customerName: null }))).toEqual([]);
  });

  it('compares dates by instant regardless of representation', () => {
    const existing = { orderDate: '2026-07-01T00:00:00.000Z' };
    expect(changedFields(existing, order({ orderDate: new Date('2026-07-01T00:00:00Z') }))).toEqual([]);
    expect(
      changedFields(existing, order({ orderDate: new Date('2026-07-02T00:00:00Z') })),
    ).toEqual(['orderDate']);
  });

  it('compares numerics loosely across string/number/Decimal representations', () => {
    expect(changedFields({ value: '150.00' }, order({ value: 150 }))).toEqual([]);
    expect(changedFields({ value: '150.00' }, order({ value: 151 }))).toEqual(['value']);
  });
});
