import { Classification } from '@control-tower/shared-types';
import { RuleEngine } from '../rule-engine';
import { createDefaultRegistry, StrategyRegistry } from '../strategy-registry';
import { EngineRule } from '../types';
import { AlwaysStrategy } from '../strategies/always.strategy';

const registry = createDefaultRegistry(() => new Date('2026-08-11T12:00:00Z'));
const engine = new RuleEngine(registry);

function rule(partial: Partial<EngineRule>): EngineRule {
  return {
    id: 'r-' + Math.random().toString(36).slice(2, 8),
    name: 'rule',
    priority: 100,
    enabled: true,
    strategy: 'field-match',
    ruleDefinition: { conditions: [{ field: 'orderStatus', operator: 'eq', value: 'x' }] },
    outcome: Classification.PENDING,
    ...partial,
  };
}

const order = {
  orderNumber: 'ORD-1',
  productCode: 'P-1',
  orderStatus: 'Cancelled',
  orderDate: '2026-08-01T00:00:00Z',
};

describe('RuleEngine', () => {
  it('first matching rule in priority order wins', () => {
    const rules = [
      rule({
        name: 'Completed', priority: 20,
        ruleDefinition: { conditions: [{ field: 'orderStatus', operator: 'eq', value: 'Delivered' }] },
        outcome: Classification.COMPLETED,
      }),
      rule({
        name: 'Cancelled', priority: 10,
        ruleDefinition: { conditions: [{ field: 'orderStatus', operator: 'eq', value: 'Cancelled' }] },
        outcome: Classification.CANCELLED,
      }),
      rule({
        name: 'Catch-all cancelled', priority: 30,
        ruleDefinition: { conditions: [{ field: 'orderStatus', operator: 'contains', value: 'cancel' }] },
        outcome: Classification.EXCEPTION,
      }),
    ];
    const result = engine.evaluate(order, rules);
    expect(result.classification).toBe(Classification.CANCELLED);
    expect(result.matchedRule?.name).toBe('Cancelled');
    expect(result.reason).toContain('Cancelled');
    // stops at first match: only the priority-10 rule was evaluated
    expect(result.trace).toHaveLength(1);
    expect(result.trace[0].matched).toBe(true);
  });

  it('records non-matching rules in the trace before the match', () => {
    const rules = [
      rule({
        name: 'NoMatch', priority: 1,
        ruleDefinition: { conditions: [{ field: 'orderStatus', operator: 'eq', value: 'Delivered' }] },
        outcome: Classification.COMPLETED,
      }),
      rule({ name: 'CatchAll', priority: 2, strategy: 'always', ruleDefinition: {}, outcome: Classification.PLACED }),
    ];
    const result = engine.evaluate(order, rules);
    expect(result.trace.map((t) => [t.ruleName, t.matched])).toEqual([
      ['NoMatch', false],
      ['CatchAll', true],
    ]);
    expect(result.classification).toBe(Classification.PLACED);
  });

  it('skips disabled rules entirely', () => {
    const rules = [
      rule({ name: 'Disabled', priority: 1, enabled: false, strategy: 'always', ruleDefinition: {}, outcome: Classification.EXCEPTION }),
    ];
    const result = engine.evaluate(order, rules);
    expect(result.classification).toBe(Classification.INVESTIGATE_REQUIRED);
    expect(result.trace).toHaveLength(0);
    expect(result.matchedRule).toBeNull();
  });

  it('falls back when no rule matches (configurable outcome)', () => {
    const custom = new RuleEngine(registry, { fallbackOutcome: Classification.EXCEPTION });
    const result = custom.evaluate(order, []);
    expect(result.classification).toBe(Classification.EXCEPTION);
    expect(result.reason).toMatch(/fallback/i);
  });

  it('an unknown strategy is traced as an error, not thrown', () => {
    const rules = [
      rule({ name: 'Broken', priority: 1, strategy: 'does-not-exist' }),
      rule({ name: 'CatchAll', priority: 2, strategy: 'always', ruleDefinition: {}, outcome: Classification.COMPLETED }),
    ];
    const result = engine.evaluate(order, rules);
    expect(result.trace[0].detail.error).toMatch(/Unknown rule strategy/);
    expect(result.classification).toBe(Classification.COMPLETED);
  });

  it('order-age rules work end-to-end through the engine', () => {
    const rules = [
      rule({
        name: 'Stale order', priority: 5, strategy: 'order-age',
        ruleDefinition: { olderThanDays: 5, dateField: 'orderDate' },
        outcome: Classification.INVESTIGATE_REQUIRED,
      }),
    ];
    const result = engine.evaluate(order, rules);
    expect(result.classification).toBe(Classification.INVESTIGATE_REQUIRED);
    expect(result.matchedRule?.name).toBe('Stale order');
  });

  it('ties on priority break deterministically by name', () => {
    const rules = [
      rule({ name: 'b-rule', priority: 1, strategy: 'always', ruleDefinition: {}, outcome: Classification.PENDING }),
      rule({ name: 'a-rule', priority: 1, strategy: 'always', ruleDefinition: {}, outcome: Classification.PLACED }),
    ];
    expect(engine.evaluate(order, rules).matchedRule?.name).toBe('a-rule');
  });
});

describe('StrategyRegistry', () => {
  it('registers and lists strategies, throws on unknown', () => {
    const r = new StrategyRegistry().register(new AlwaysStrategy());
    expect(r.has('always')).toBe(true);
    expect(r.list()).toEqual(['always']);
    expect(() => r.get('nope')).toThrow(/Unknown rule strategy/);
  });

  it('default registry contains the built-in strategies', () => {
    expect(createDefaultRegistry().list().sort()).toEqual(['always', 'field-match', 'order-age']);
  });
});
