import { OrderAgeStrategy } from '../strategies/order-age.strategy';

const NOW = new Date('2026-08-11T12:00:00Z');
const strategy = new OrderAgeStrategy(() => NOW);

describe('OrderAgeStrategy', () => {
  it('matches orders older than the threshold', () => {
    const result = strategy.evaluate(
      { olderThanDays: 14 },
      { orderDate: '2026-07-01T00:00:00Z' },
    );
    expect(result.matched).toBe(true);
    expect(result.detail.olderThanDays).toBe(14);
  });

  it('does not match recent orders', () => {
    const result = strategy.evaluate(
      { olderThanDays: 14 },
      { orderDate: '2026-08-10T00:00:00Z' },
    );
    expect(result.matched).toBe(false);
  });

  it('supports alternative date fields', () => {
    const result = strategy.evaluate(
      { olderThanDays: 1, dateField: 'importedAt' },
      { importedAt: '2026-08-01T00:00:00Z', orderDate: null },
    );
    expect(result.matched).toBe(true);
  });

  it('fails safely on a missing or invalid date', () => {
    expect(strategy.evaluate({ olderThanDays: 1 }, {}).matched).toBe(false);
    expect(
      strategy.evaluate({ olderThanDays: 1 }, { orderDate: 'not-a-date' }).matched,
    ).toBe(false);
  });

  it('applies the optional status restriction', () => {
    const def = { olderThanDays: 14, whenStatusIn: ['Placed', 'Processing'] };
    expect(
      strategy.evaluate(def, { orderDate: '2026-07-01', orderStatus: 'placed' }).matched,
    ).toBe(true);
    expect(
      strategy.evaluate(def, { orderDate: '2026-07-01', orderStatus: 'Shipped' }).matched,
    ).toBe(false);
  });

  describe('validate', () => {
    it('rejects missing/negative olderThanDays', () => {
      expect(() => strategy.validate({} as never)).toThrow(/olderThanDays/);
      expect(() => strategy.validate({ olderThanDays: -1 } as never)).toThrow(/olderThanDays/);
    });
    it('rejects invalid dateField', () => {
      expect(() =>
        strategy.validate({ olderThanDays: 1, dateField: 'updatedAt' } as never),
      ).toThrow(/dateField/);
    });
    it('accepts a valid definition', () => {
      expect(() => strategy.validate({ olderThanDays: 30, dateField: 'orderDate' })).not.toThrow();
    });
  });
});
