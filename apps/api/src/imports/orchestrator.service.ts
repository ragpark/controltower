import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  changedFields,
  ConnectorRegistry,
  createDefaultConnectorRegistry,
  dedupeWithinBatch,
  FetchedFile,
  NormalizedOrder,
  parseCsvOrders,
} from '@control-tower/ingestion';
import {
  EVENTS,
  ImportLogEntry,
  ImportRunStatus,
  SourceConfig,
  SourceType,
} from '@control-tower/shared-types';
import { ImportRun, Order, Prisma, Source } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClassificationService } from '../rules/classification.service';
import { MetricsService } from '../observability/metrics.service';

/**
 * Ingestion orchestration pipeline:
 * detect → fetch → parse/map → validate → dedupe → persist (+history) →
 * classify → aggregate (via events) → publish events.
 */
@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);
  readonly connectors: ConnectorRegistry;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly classification: ClassificationService,
    private readonly metrics: MetricsService,
    config: ConfigService,
  ) {
    this.connectors = createDefaultConnectorRegistry({
      csvFileBaseDir: config.get<string>('ingestion.dataDir'),
    });
  }

  /** Scheduled/manual pull: fetch files from the source's connector and import them. */
  async runSource(sourceId: string, actor: string): Promise<ImportRun[]> {
    const source = await this.prisma.source.findUnique({ where: { id: sourceId } });
    if (!source) throw new NotFoundException('Source not found');

    const connector = this.connectors.get(source.type as SourceType);
    let files: FetchedFile[];
    try {
      files = await connector.fetch(source.configJson as SourceConfig);
    } catch (error) {
      const run = await this.createRun(source, null, actor);
      return [await this.failRun(run, source, error, actor)];
    }

    if (files.length === 0) {
      this.logger.log(`Source "${source.name}": nothing to import`);
      await this.prisma.source.update({
        where: { id: source.id },
        data: { lastRunAt: new Date() },
      });
      return [];
    }

    const runs: ImportRun[] = [];
    for (const file of files) {
      runs.push(await this.importFile(source, file, actor));
    }
    return runs;
  }

  /** Manual upload path — same pipeline, file pushed by the user. */
  async importUpload(sourceId: string, file: FetchedFile, actor: string): Promise<ImportRun> {
    const source = await this.prisma.source.findUnique({ where: { id: sourceId } });
    if (!source) throw new NotFoundException('Source not found');
    return this.importFile(source, file, actor);
  }

  private async createRun(source: Source, filename: string | null, actor: string) {
    return this.prisma.importRun.create({
      data: { sourceId: source.id, filename, triggeredBy: actor },
    });
  }

  private async failRun(
    run: ImportRun,
    source: Source,
    error: unknown,
    actor: string,
  ): Promise<ImportRun> {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`Import ${run.id} failed: ${message}`);
    this.metrics.importRuns.inc({ status: 'FAILED' });
    const failed = await this.prisma.importRun.update({
      where: { id: run.id },
      data: {
        status: ImportRunStatus.FAILED,
        endTime: new Date(),
        log: [logEntry('error', message)] as unknown as Prisma.InputJsonValue,
      },
    });
    await this.prisma.source.update({
      where: { id: source.id },
      data: { status: 'ERROR', lastRunAt: new Date() },
    });
    this.events.emit(EVENTS.IMPORT_FAILED, {
      importRunId: run.id,
      sourceId: source.id,
      error: message,
      actor,
    });
    return failed;
  }

  async importFile(source: Source, file: FetchedFile, actor: string): Promise<ImportRun> {
    const run = await this.createRun(source, file.filename, actor);
    const started = Date.now();
    const log: ImportLogEntry[] = [logEntry('info', `Importing ${file.filename}`)];

    try {
      const config = (source.configJson ?? {}) as SourceConfig;
      const parsed = parseCsvOrders(file.content, {
        mapping: config.mapping,
        delimiter: config.delimiter,
      });
      for (const err of parsed.errors) {
        log.push(logEntry('error', err.message, err.row));
      }

      const { unique, duplicates } = dedupeWithinBatch(parsed.orders);
      for (const dup of duplicates) {
        log.push(
          logEntry('warn', `Duplicate rows for key ${dup.key} — last occurrence kept (${dup.occurrences} rows)`),
        );
      }

      const rules = await this.classification.loadRules();
      let successful = 0;

      for (const normalized of unique) {
        try {
          const { order, created, changed } = await this.upsertOrder(
            normalized,
            source,
            run.id,
            file.filename,
          );
          const eventPayload = {
            orderId: order.id,
            orderNumber: order.orderNumber,
            productCode: order.productCode,
            importRunId: run.id,
            sourceId: source.id,
            actor,
          };
          if (created) {
            this.events.emit(EVENTS.ORDER_IMPORTED, eventPayload);
          } else if (changed.length > 0) {
            this.events.emit(EVENTS.ORDER_UPDATED, { ...eventPayload, changedFields: changed });
          }
          // classify new orders and any order whose data changed
          if (created || changed.length > 0 || order.classification === null) {
            await this.classification.classifyOrder(order, rules, actor);
          }
          successful += 1;
          this.metrics.rowsImported.inc({ result: 'success' });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          log.push(logEntry('error', `Order ${normalized.orderNumber}/${normalized.productCode}: ${message}`));
          this.metrics.rowsImported.inc({ result: 'failed' });
        }
      }

      const failedRows = parsed.errors.length + (unique.length - successful);
      const status =
        failedRows > 0 ? ImportRunStatus.COMPLETED_WITH_ERRORS : ImportRunStatus.COMPLETED;
      log.push(
        logEntry('info', `Finished: ${successful} succeeded, ${failedRows} failed of ${parsed.totalRows} rows`),
      );

      const completed = await this.prisma.importRun.update({
        where: { id: run.id },
        data: {
          status,
          endTime: new Date(),
          totalRows: parsed.totalRows,
          importedRows: unique.length,
          successfulRows: successful,
          failedRows,
          log: log as unknown as Prisma.InputJsonValue,
        },
      });
      await this.prisma.source.update({
        where: { id: source.id },
        data: { lastRunAt: new Date(), status: 'ACTIVE' },
      });

      this.metrics.importRuns.inc({ status });
      this.metrics.importDuration.observe((Date.now() - started) / 1000);
      this.events.emit(EVENTS.IMPORT_COMPLETED, {
        importRunId: run.id,
        sourceId: source.id,
        successfulRows: successful,
        failedRows,
        actor,
      });
      return completed;
    } catch (error) {
      return this.failRun(run, source, error, actor);
    }
  }

  /**
   * Deduplicate on (orderNumber, productCode). Updates preserve history:
   * the previous state is snapshotted into order_history with the changed fields.
   */
  private async upsertOrder(
    normalized: NormalizedOrder,
    source: Source,
    runId: string,
    filename: string,
  ): Promise<{ order: Order; created: boolean; changed: string[] }> {
    const existing = await this.prisma.order.findUnique({
      where: {
        orderNumber_productCode: {
          orderNumber: normalized.orderNumber,
          productCode: normalized.productCode,
        },
      },
    });

    const data = {
      sourceOrderId: normalized.sourceOrderId,
      customerId: normalized.customerId,
      customerName: normalized.customerName,
      productName: normalized.productName,
      orderStatus: normalized.orderStatus,
      orderState: normalized.orderState,
      quantity: normalized.quantity,
      value: normalized.value,
      orderDate: normalized.orderDate,
      sourceFile: filename,
      sourceId: source.id,
      importRunId: runId,
      importedAt: new Date(),
    };

    if (!existing) {
      const order = await this.prisma.order.create({
        data: {
          ...data,
          orderNumber: normalized.orderNumber,
          productCode: normalized.productCode,
        },
      });
      return { order, created: true, changed: [] };
    }

    const changed = changedFields(
      existing as unknown as Partial<Record<keyof NormalizedOrder, unknown>>,
      normalized,
    );
    if (changed.length === 0) {
      return { order: existing, created: false, changed: [] };
    }

    const [, order] = await this.prisma.$transaction([
      this.prisma.orderHistory.create({
        data: {
          orderId: existing.id,
          snapshot: JSON.parse(JSON.stringify(existing)) as Prisma.InputJsonValue,
          changedFields: changed,
          importRunId: runId,
        },
      }),
      this.prisma.order.update({ where: { id: existing.id }, data }),
    ]);
    return { order, created: false, changed };
  }
}

function logEntry(level: ImportLogEntry['level'], message: string, row?: number): ImportLogEntry {
  return { level, message, row, timestamp: new Date().toISOString() };
}
