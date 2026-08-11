import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  AuditAction,
  EVENTS,
  ImportCompletedEvent,
  ImportFailedEvent,
  OrderClassifiedEvent,
  OrderImportedEvent,
  OrderUpdatedEvent,
} from '@control-tower/shared-types';
import { AuditService } from './audit.service';

/** Every domain event lands in the audit trail. */
@Injectable()
export class AuditEventsListener {
  constructor(private readonly audit: AuditService) {}

  @OnEvent(EVENTS.ORDER_IMPORTED)
  async onOrderImported(event: OrderImportedEvent) {
    await this.audit.record({
      entityType: 'order',
      entityId: event.orderId,
      action: AuditAction.IMPORT,
      changedBy: event.actor,
      changes: { orderNumber: event.orderNumber, importRunId: event.importRunId },
    });
  }

  @OnEvent(EVENTS.ORDER_UPDATED)
  async onOrderUpdated(event: OrderUpdatedEvent) {
    await this.audit.record({
      entityType: 'order',
      entityId: event.orderId,
      action: AuditAction.UPDATE,
      changedBy: event.actor,
      changes: { changedFields: event.changedFields, importRunId: event.importRunId },
    });
  }

  @OnEvent(EVENTS.ORDER_CLASSIFIED)
  async onOrderClassified(event: OrderClassifiedEvent) {
    await this.audit.record({
      entityType: 'order',
      entityId: event.orderId,
      action: AuditAction.CLASSIFY,
      changedBy: event.actor,
      changes: { classification: event.classification, ruleName: event.ruleName },
    });
  }

  @OnEvent(EVENTS.ORDER_RECLASSIFIED)
  async onOrderReclassified(event: OrderClassifiedEvent) {
    await this.audit.record({
      entityType: 'order',
      entityId: event.orderId,
      action: AuditAction.RECLASSIFY,
      changedBy: event.actor,
      changes: {
        from: event.previousClassification,
        to: event.classification,
        ruleName: event.ruleName,
      },
    });
  }

  @OnEvent(EVENTS.IMPORT_COMPLETED)
  async onImportCompleted(event: ImportCompletedEvent) {
    await this.audit.record({
      entityType: 'import_run',
      entityId: event.importRunId,
      action: AuditAction.IMPORT,
      changedBy: event.actor,
      changes: { successfulRows: event.successfulRows, failedRows: event.failedRows },
    });
  }

  @OnEvent(EVENTS.IMPORT_FAILED)
  async onImportFailed(event: ImportFailedEvent) {
    await this.audit.record({
      entityType: 'import_run',
      entityId: event.importRunId,
      action: AuditAction.IMPORT,
      changedBy: event.actor,
      changes: { failed: true, error: event.error },
    });
  }
}
