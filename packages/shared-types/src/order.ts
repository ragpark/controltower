import { Classification } from './enums';

export interface OrderDto {
  id: string;
  sourceOrderId: string | null;
  orderNumber: string;
  orderSource: string | null;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  productCode: string;
  productName: string | null;
  orderStatus: string | null;
  orderState: string | null;
  licenceOrderMatch: string | null;
  licenceIsbnMatch: string | null;
  classification: Classification | null;
  classificationReason: string | null;
  classifiedAt: string | null;
  quantity: number | null;
  value: string | null;
  orderDate: string | null;
  createdAt: string;
  updatedAt: string;
  importedAt: string;
  sourceFile: string | null;
  sourceId: string | null;
  sourceName?: string | null;
  importRunId: string | null;
}

export interface OrderHistoryDto {
  id: string;
  orderId: string;
  snapshot: Record<string, unknown>;
  changedFields: string[];
  importRunId: string | null;
  createdAt: string;
}

export interface RuleExecutionDto {
  id: string;
  orderId: string;
  ruleId: string | null;
  ruleName: string;
  priority: number;
  matched: boolean;
  outcome: Classification | null;
  detail: Record<string, unknown> | null;
  evaluationId: string;
  evaluatedAt: string;
}

export interface AuditLogDto {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  changedBy: string;
  changes: Record<string, unknown> | null;
  timestamp: string;
}

export type BulkOrderAction = 'reclassify' | 'rerun-rules';

export interface BulkOrderRequest {
  ids: string[];
  action: BulkOrderAction;
  classification?: Classification;
  reason?: string;
}

/** A single stored row inside a suspected duplicate group (FR-21). */
export interface DuplicateVariantDto {
  id: string;
  orderNumber: string;
  productCode: string;
  productName: string | null;
  orderStatus: string | null;
  classification: string | null;
  importedAt: string;
  sourceFile: string | null;
  importRunId: string | null;
  /** True for the row that would be kept: the most recently imported. */
  survivor: boolean;
}

export interface DuplicateGroupDto {
  /** Case-insensitive natural key shared by every variant. */
  key: string;
  orderNumber: string;
  productCode: string;
  variantCount: number;
  removableCount: number;
  variants: DuplicateVariantDto[];
}

export interface DuplicateReportDto {
  groups: DuplicateGroupDto[];
  groupCount: number;
  removableCount: number;
}

export interface DuplicateResolutionResultDto {
  groupsResolved: number;
  ordersRemoved: number;
  historyRowsReattached: number;
  ruleExecutionsReattached: number;
  ordersResynced: number;
}
