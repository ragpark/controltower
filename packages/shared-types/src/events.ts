import { Classification } from './enums';

export const EVENTS = {
  ORDER_IMPORTED: 'order.imported',
  ORDER_UPDATED: 'order.updated',
  ORDER_CLASSIFIED: 'order.classified',
  ORDER_RECLASSIFIED: 'order.reclassified',
  IMPORT_COMPLETED: 'import.completed',
  IMPORT_FAILED: 'import.failed',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

export interface OrderImportedEvent {
  orderId: string;
  orderNumber: string;
  productCode: string;
  importRunId: string;
  sourceId: string;
  actor: string;
}

export interface OrderUpdatedEvent extends OrderImportedEvent {
  changedFields: string[];
}

export interface OrderClassifiedEvent {
  orderId: string;
  orderNumber: string;
  productCode: string;
  classification: Classification;
  previousClassification: Classification | null;
  ruleName: string | null;
  evaluationId: string;
  actor: string;
}

export interface ImportCompletedEvent {
  importRunId: string;
  sourceId: string;
  successfulRows: number;
  failedRows: number;
  actor: string;
}

export interface ImportFailedEvent {
  importRunId: string;
  sourceId: string;
  error: string;
  actor: string;
}
