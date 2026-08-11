import { RuleDefinition } from '@control-tower/shared-types';
import { EvaluableOrder, StrategyEvaluation } from '../types';
import { RuleStrategy } from './rule-strategy';

/** Always matches — use as the lowest-priority catch-all rule. */
export class AlwaysStrategy implements RuleStrategy {
  readonly type = 'always';

  validate(_definition: RuleDefinition): void {
    // no configuration
  }

  evaluate(_definition: RuleDefinition, _order: EvaluableOrder): StrategyEvaluation {
    return { matched: true, detail: { reason: 'catch-all rule' } };
  }
}
