import { RuleDefinition } from '@control-tower/shared-types';
import { EvaluableOrder, StrategyEvaluation } from '../types';

/**
 * Strategy pattern seam: implement this interface and register the instance
 * with the StrategyRegistry to add a new rule type — no engine changes needed.
 */
export interface RuleStrategy {
  /** Unique key referenced by ClassificationRule.strategy */
  readonly type: string;
  /** Validate a definition; throw with a helpful message when invalid. */
  validate(definition: RuleDefinition): void;
  evaluate(definition: RuleDefinition, order: EvaluableOrder): StrategyEvaluation;
}
