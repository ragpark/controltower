import {
  FieldMatchDefinition,
  RuleCondition,
  RuleDefinition,
} from '@control-tower/shared-types';
import { EvaluableOrder, StrategyEvaluation } from '../types';
import { RuleStrategy } from './rule-strategy';

const OPERATORS = new Set([
  'eq', 'neq', 'in', 'notIn', 'contains', 'startsWith',
  'gt', 'gte', 'lt', 'lte', 'isEmpty', 'notEmpty', 'regex',
]);

function normalise(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function asNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function evaluateCondition(
  condition: RuleCondition,
  order: EvaluableOrder,
): { passed: boolean; actual: string } {
  const raw = order[condition.field];
  const actual = normalise(raw);
  const expected = condition.value;

  switch (condition.operator) {
    case 'eq':
      return { passed: actual.toLowerCase() === normalise(expected).toLowerCase(), actual };
    case 'neq':
      return { passed: actual.toLowerCase() !== normalise(expected).toLowerCase(), actual };
    case 'in': {
      const list = Array.isArray(expected) ? expected : [expected];
      return {
        passed: list.some((v) => normalise(v).toLowerCase() === actual.toLowerCase()),
        actual,
      };
    }
    case 'notIn': {
      const list = Array.isArray(expected) ? expected : [expected];
      return {
        passed: !list.some((v) => normalise(v).toLowerCase() === actual.toLowerCase()),
        actual,
      };
    }
    case 'contains':
      return { passed: actual.toLowerCase().includes(normalise(expected).toLowerCase()), actual };
    case 'startsWith':
      return { passed: actual.toLowerCase().startsWith(normalise(expected).toLowerCase()), actual };
    case 'gt': case 'gte': case 'lt': case 'lte': {
      const a = asNumber(raw);
      const b = asNumber(expected);
      if (a === null || b === null) return { passed: false, actual };
      const ops = { gt: a > b, gte: a >= b, lt: a < b, lte: a <= b };
      return { passed: ops[condition.operator], actual };
    }
    case 'isEmpty':
      return { passed: actual === '', actual };
    case 'notEmpty':
      return { passed: actual !== '', actual };
    case 'regex': {
      try {
        return { passed: new RegExp(String(expected), 'i').test(actual), actual };
      } catch {
        return { passed: false, actual };
      }
    }
    default:
      return { passed: false, actual };
  }
}

/**
 * Matches when the order's fields satisfy a set of conditions combined with
 * AND (`match: 'all'`, default) or OR (`match: 'any'`).
 */
export class FieldMatchStrategy implements RuleStrategy {
  readonly type = 'field-match';

  validate(definition: RuleDefinition): void {
    const def = definition as FieldMatchDefinition;
    if (!def || !Array.isArray(def.conditions) || def.conditions.length === 0) {
      throw new Error('field-match requires a non-empty "conditions" array');
    }
    for (const c of def.conditions) {
      if (!c.field || typeof c.field !== 'string') {
        throw new Error('Each condition requires a "field"');
      }
      if (!OPERATORS.has(c.operator)) {
        throw new Error(`Unknown operator "${c.operator}"`);
      }
      const needsValue = !['isEmpty', 'notEmpty'].includes(c.operator);
      if (needsValue && (c.value === undefined || c.value === null)) {
        throw new Error(`Operator "${c.operator}" on "${c.field}" requires a value`);
      }
    }
    if (def.match && !['all', 'any'].includes(def.match)) {
      throw new Error('match must be "all" or "any"');
    }
  }

  evaluate(definition: RuleDefinition, order: EvaluableOrder): StrategyEvaluation {
    const def = definition as FieldMatchDefinition;
    const results = def.conditions.map((c) => {
      const { passed, actual } = evaluateCondition(c, order);
      return {
        field: c.field,
        operator: c.operator,
        expected: c.value ?? null,
        actual,
        passed,
      };
    });
    const matched =
      def.match === 'any' ? results.some((r) => r.passed) : results.every((r) => r.passed);
    return { matched, detail: { match: def.match ?? 'all', conditions: results } };
  }
}
