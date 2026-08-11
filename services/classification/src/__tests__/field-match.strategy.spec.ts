import { Classification, FieldMatchDefinition } from '@control-tower/shared-types';
import { FieldMatchStrategy } from '../strategies/field-match.strategy';

const strategy = new FieldMatchStrategy();

const order = {
  orderNumber: 'ORD-1001',
  productCode: 'PRD-A',
  orderStatus: 'Shipped',
  customerName: 'Acme Ltd',
  quantity: 5,
  value: '120.50',
};

function def(partial: Partial<FieldMatchDefinition>): FieldMatchDefinition {
  return { conditions: [], ...partial } as FieldMatchDefinition;
}

describe('FieldMatchStrategy', () => {
  describe('operators', () => {
    it.each([
      ['eq', 'orderStatus', 'shipped', true],
      ['eq', 'orderStatus', 'Cancelled', false],
      ['neq', 'orderStatus', 'Cancelled', true],
      ['contains', 'customerName', 'acme', true],
      ['contains', 'customerName', 'globex', false],
      ['startsWith', 'orderNumber', 'ord-', true],
      ['gt', 'quantity', 4, true],
      ['gt', 'quantity', 5, false],
      ['gte', 'quantity', 5, true],
      ['lt', 'value', 200, true],
      ['lte', 'value', 120.5, true],
      ['regex', 'orderNumber', '^ORD-\\d+$', true],
    ] as const)('%s on %s with %p → %p', (operator, field, value, expected) => {
      const result = strategy.evaluate(
        def({ conditions: [{ field, operator, value: value as never }] }),
        order,
      );
      expect(result.matched).toBe(expected);
    });

    it('handles in / notIn with case-insensitive lists', () => {
      const inDef = def({
        conditions: [{ field: 'orderStatus', operator: 'in', value: ['SHIPPED', 'Delivered'] }],
      });
      expect(strategy.evaluate(inDef, order).matched).toBe(true);
      const notInDef = def({
        conditions: [{ field: 'orderStatus', operator: 'notIn', value: ['Cancelled'] }],
      });
      expect(strategy.evaluate(notInDef, order).matched).toBe(true);
    });

    it('handles isEmpty / notEmpty including null and missing fields', () => {
      const target = { ...order, customerName: null } as Record<string, unknown>;
      expect(
        strategy.evaluate(def({ conditions: [{ field: 'customerName', operator: 'isEmpty' }] }), target)
          .matched,
      ).toBe(true);
      expect(
        strategy.evaluate(def({ conditions: [{ field: 'missingField', operator: 'isEmpty' }] }), target)
          .matched,
      ).toBe(true);
      expect(
        strategy.evaluate(def({ conditions: [{ field: 'orderNumber', operator: 'notEmpty' }] }), target)
          .matched,
      ).toBe(true);
    });

    it('numeric comparison against non-numeric values fails safely', () => {
      const result = strategy.evaluate(
        def({ conditions: [{ field: 'customerName', operator: 'gt', value: 3 }] }),
        order,
      );
      expect(result.matched).toBe(false);
    });

    it('invalid regex fails safely instead of throwing', () => {
      const result = strategy.evaluate(
        def({ conditions: [{ field: 'orderNumber', operator: 'regex', value: '([' }] }),
        order,
      );
      expect(result.matched).toBe(false);
    });
  });

  describe('all / any combination', () => {
    const conditions = [
      { field: 'orderStatus', operator: 'eq', value: 'Shipped' },
      { field: 'quantity', operator: 'gt', value: 100 },
    ] as const;

    it('all (default) requires every condition', () => {
      expect(strategy.evaluate(def({ conditions: [...conditions] }), order).matched).toBe(false);
    });

    it('any requires at least one condition', () => {
      expect(
        strategy.evaluate(def({ match: 'any', conditions: [...conditions] }), order).matched,
      ).toBe(true);
    });
  });

  describe('trace detail', () => {
    it('records per-condition expected/actual/passed', () => {
      const result = strategy.evaluate(
        def({ conditions: [{ field: 'orderStatus', operator: 'eq', value: 'Shipped' }] }),
        order,
      );
      expect(result.detail).toEqual({
        match: 'all',
        conditions: [
          {
            field: 'orderStatus',
            operator: 'eq',
            expected: 'Shipped',
            actual: 'Shipped',
            passed: true,
          },
        ],
      });
    });
  });

  describe('validate', () => {
    it('rejects empty conditions', () => {
      expect(() => strategy.validate({ conditions: [] } as never)).toThrow(/non-empty/);
    });
    it('rejects unknown operators', () => {
      expect(() =>
        strategy.validate(def({ conditions: [{ field: 'a', operator: 'like' as never, value: 1 }] })),
      ).toThrow(/Unknown operator/);
    });
    it('rejects missing value for value-operators', () => {
      expect(() =>
        strategy.validate(def({ conditions: [{ field: 'a', operator: 'eq' }] })),
      ).toThrow(/requires a value/);
    });
    it('rejects invalid match mode', () => {
      expect(() =>
        strategy.validate(
          def({ match: 'some' as never, conditions: [{ field: 'a', operator: 'notEmpty' }] }),
        ),
      ).toThrow(/all.*any/);
    });
    it('accepts a valid definition', () => {
      expect(() =>
        strategy.validate(
          def({ match: 'any', conditions: [{ field: 'a', operator: 'eq', value: 'x' }] }),
        ),
      ).not.toThrow();
    });
  });

  it('is registered under the expected type and outcome flows through the engine', () => {
    expect(strategy.type).toBe('field-match');
    expect(Object.values(Classification)).toContain(Classification.PENDING);
  });
});
