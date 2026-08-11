import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly importRuns = new Counter({
    name: 'octower_import_runs_total',
    help: 'Import runs by outcome',
    labelNames: ['status'] as const,
    registers: [this.registry],
  });

  readonly rowsImported = new Counter({
    name: 'octower_rows_imported_total',
    help: 'Rows processed by result',
    labelNames: ['result'] as const,
    registers: [this.registry],
  });

  readonly ordersClassified = new Counter({
    name: 'octower_orders_classified_total',
    help: 'Classification outcomes',
    labelNames: ['classification'] as const,
    registers: [this.registry],
  });

  readonly importDuration = new Histogram({
    name: 'octower_import_duration_seconds',
    help: 'Import run duration',
    buckets: [0.5, 1, 5, 15, 60, 300],
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }

  metrics(): Promise<string> {
    return this.registry.metrics();
  }
}
