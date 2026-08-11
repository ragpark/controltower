import { Injectable, Logger } from '@nestjs/common';

export type ErrorSink = (error: Error, context?: Record<string, unknown>) => void;

/**
 * Error-tracking seam. Register a sink (Sentry.captureException,
 * appInsights.trackException, …) at bootstrap; until then errors are logged
 * as structured JSON so nothing is lost.
 */
@Injectable()
export class ErrorTrackingService {
  private readonly logger = new Logger('ErrorTracking');
  private readonly sinks: ErrorSink[] = [];

  registerSink(sink: ErrorSink): void {
    this.sinks.push(sink);
  }

  captureException(error: Error, context?: Record<string, unknown>): void {
    this.logger.error(
      JSON.stringify({ message: error.message, ...context }),
      error.stack,
    );
    for (const sink of this.sinks) {
      try {
        sink(error, context);
      } catch {
        // a broken sink must never take the request down
      }
    }
  }
}
