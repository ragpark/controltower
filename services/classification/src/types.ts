import { Classification, RuleDefinition } from '@control-tower/shared-types';

/**
 * The order shape the engine evaluates against. A plain record so the engine
 * stays decoupled from persistence — the API maps Prisma rows into this.
 */
export interface EvaluableOrder {
  [key: string]: unknown;
  orderNumber?: string;
  productCode?: string;
  orderStatus?: string | null;
  orderState?: string | null;
  customerName?: string | null;
  productName?: string | null;
  quantity?: number | null;
  value?: number | string | null;
  orderDate?: Date | string | null;
  createdAt?: Date | string | null;
  importedAt?: Date | string | null;
}

export interface EngineRule {
  id: string | null;
  name: string;
  priority: number;
  enabled: boolean;
  strategy: string;
  ruleDefinition: RuleDefinition;
  outcome: Classification;
}

export interface StrategyEvaluation {
  matched: boolean;
  /** Human-readable per-condition detail for the execution trace. */
  detail: Record<string, unknown>;
}

export interface RuleTraceEntry {
  ruleId: string | null;
  ruleName: string;
  priority: number;
  matched: boolean;
  outcome: Classification | null;
  detail: Record<string, unknown>;
}

export interface EvaluationResult {
  classification: Classification;
  matchedRule: EngineRule | null;
  reason: string;
  trace: RuleTraceEntry[];
}
