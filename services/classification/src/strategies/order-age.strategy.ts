import { OrderAgeDefinition, RuleDefinition } from '@control-tower/shared-types';
import { EvaluableOrder, StrategyEvaluation } from '../types';
import { RuleStrategy } from './rule-strategy';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Matches orders older than N days (by orderDate/createdAt/importedAt),
 * optionally limited to a set of raw statuses. Used for stale-order detection
 * (e.g. "placed more than 14 days ago and still not completed → Investigate").
 */
export class OrderAgeStrategy implements RuleStrategy {
  readonly type = 'order-age';

  constructor(private readonly now: () => Date = () => new Date()) {}

  validate(definition: RuleDefinition): void {
    const def = definition as OrderAgeDefinition;
    if (!def || typeof def.olderThanDays !== 'number' || def.olderThanDays < 0) {
      throw new Error('order-age requires a non-negative "olderThanDays" number');
    }
    if (def.dateField && !['orderDate', 'createdAt', 'importedAt'].includes(def.dateField)) {
      throw new Error('dateField must be one of orderDate, createdAt, importedAt');
    }
  }

  evaluate(definition: RuleDefinition, order: EvaluableOrder): StrategyEvaluation {
    const def = definition as OrderAgeDefinition;
    const field = def.dateField ?? 'orderDate';
    const rawDate = order[field];
    const date = rawDate ? new Date(rawDate as string | Date) : null;

    if (!date || Number.isNaN(date.getTime())) {
      return {
        matched: false,
        detail: { field, reason: 'date missing or invalid', value: String(rawDate ?? '') },
      };
    }

    const ageDays = (this.now().getTime() - date.getTime()) / MS_PER_DAY;
    let matched = ageDays > def.olderThanDays;

    let statusOk: boolean | undefined;
    if (matched && def.whenStatusIn && def.whenStatusIn.length > 0) {
      const status = String(order.orderStatus ?? '').toLowerCase();
      statusOk = def.whenStatusIn.some((s) => s.toLowerCase() === status);
      matched = statusOk;
    }

    return {
      matched,
      detail: {
        field,
        ageDays: Math.round(ageDays * 10) / 10,
        olderThanDays: def.olderThanDays,
        ...(statusOk !== undefined ? { statusRestrictionPassed: statusOk } : {}),
      },
    };
  }
}
