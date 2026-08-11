import { Classification } from './enums';

export type RuleOperator =
  | 'eq'
  | 'neq'
  | 'in'
  | 'notIn'
  | 'contains'
  | 'startsWith'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'isEmpty'
  | 'notEmpty'
  | 'regex';

export interface RuleCondition {
  field: string;
  operator: RuleOperator;
  value?: string | number | string[] | number[];
}

/** Definition for the built-in `field-match` strategy. */
export interface FieldMatchDefinition {
  /** 'all' = AND (default), 'any' = OR */
  match?: 'all' | 'any';
  conditions: RuleCondition[];
}

/** Definition for the built-in `order-age` strategy. */
export interface OrderAgeDefinition {
  olderThanDays: number;
  dateField?: 'orderDate' | 'createdAt' | 'importedAt';
  /** Only applies when the order is still in one of these raw statuses (optional). */
  whenStatusIn?: string[];
}

export type RuleDefinition = FieldMatchDefinition | OrderAgeDefinition | Record<string, never>;

export interface ClassificationRuleDto {
  id: string;
  name: string;
  description: string | null;
  priority: number;
  enabled: boolean;
  strategy: string;
  ruleDefinition: RuleDefinition;
  outcome: Classification;
  createdAt: string;
  updatedAt: string;
}

export interface RulePreviewRequest {
  strategy: string;
  ruleDefinition: RuleDefinition;
  outcome: Classification;
  sampleOrder: Record<string, unknown>;
}

export interface RulePreviewResult {
  matched: boolean;
  outcome: Classification | null;
  detail: Record<string, unknown>;
}
