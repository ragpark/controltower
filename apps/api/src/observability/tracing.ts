/**
 * OpenTelemetry bootstrap. Enabled with OTEL_ENABLED=true; exports OTLP/HTTP
 * to OTEL_EXPORTER_OTLP_ENDPOINT (Azure Monitor, Grafana Tempo, Jaeger, …).
 *
 * The SDK packages are optional dependencies — when they are not installed
 * (slim images) tracing silently stays off, keeping the API bootable.
 */
export function startTracing(): void {
  if ((process.env.OTEL_ENABLED ?? 'false').toLowerCase() !== 'true') return;
  try {
    /* eslint-disable @typescript-eslint/no-var-requires */
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    /* eslint-enable @typescript-eslint/no-var-requires */

    const sdk = new NodeSDK({
      serviceName: process.env.OTEL_SERVICE_NAME ?? 'control-tower-api',
      traceExporter: new OTLPTraceExporter(),
      instrumentations: [getNodeAutoInstrumentations()],
    });
    sdk.start();
    process.on('SIGTERM', () => sdk.shutdown().catch(() => undefined));
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ level: 'log', context: 'Tracing', message: 'OpenTelemetry started' }));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      `OpenTelemetry not started (install @opentelemetry/sdk-node, auto-instrumentations-node, exporter-trace-otlp-http): ${
        error instanceof Error ? error.message : error
      }`,
    );
  }
}
