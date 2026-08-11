import { Classification } from '@control-tower/shared-types';
import { StrategyRegistry } from './strategy-registry';
import { EngineRule, EvaluableOrder, EvaluationResult, RuleTraceEntry } from './types';

export interface RuleEngineOptions {
  /** Outcome when no rule matches. Default: INVESTIGATE_REQUIRED. */
  fallbackOutcome?: Classification;
}

/**
 * Evaluates rules in ascending priority order; the first matching rule wins.
 * Every evaluated rule (matched or not) is recorded in the trace so the UI can
 * explain exactly why an order landed in its classification.
 */
export class RuleEngine {
  private readonly fallback: Classification;

  constructor(
    private readonly registry: StrategyRegistry,
    options: RuleEngineOptions = {},
  ) {
    this.fallback = options.fallbackOutcome ?? Classification.INVESTIGATE_REQUIRED;
  }

  evaluate(order: EvaluableOrder, rules: EngineRule[]): EvaluationResult {
    const active = rules
      .filter((r) => r.enabled)
      .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));

    const trace: RuleTraceEntry[] = [];

    for (const rule of active) {
      let entry: RuleTraceEntry;
      try {
        const strategy = this.registry.get(rule.strategy);
        const { matched, detail } = strategy.evaluate(rule.ruleDefinition, order);
        entry = {
          ruleId: rule.id,
          ruleName: rule.name,
          priority: rule.priority,
          matched,
          outcome: matched ? rule.outcome : null,
          detail,
        };
      } catch (error) {
        entry = {
          ruleId: rule.id,
          ruleName: rule.name,
          priority: rule.priority,
          matched: false,
          outcome: null,
          detail: { error: error instanceof Error ? error.message : String(error) },
        };
      }
      trace.push(entry);

      if (entry.matched) {
        return {
          classification: rule.outcome,
          matchedRule: rule,
          reason: `Matched rule "${rule.name}" (priority ${rule.priority})`,
          trace,
        };
      }
    }

    return {
      classification: this.fallback,
      matchedRule: null,
      reason: 'No rule matched — fallback classification applied',
      trace,
    };
  }
}
